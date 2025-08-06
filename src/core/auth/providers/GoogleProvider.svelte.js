import { AuthProvider } from '@/core/auth/AuthProvider.svelte.js'

export class GoogleProvider extends AuthProvider {
  constructor(config) {
    super('google', 'Google', config)
    this.authUrl = 'https://accounts.google.com/oauth2/v2/auth'
    this.tokenUrl = 'https://oauth2.googleapis.com/token'
    this.userInfoUrl = 'https://www.googleapis.com/oauth2/v2/userinfo'
    this.scope = 'openid profile email'
  }

  requiredConfigKeys() {
    return ['clientId', 'clientSecret', 'redirectUri']
  }

  async initialize() {
    await super.initialize()
    
    if (window.location.hash.includes('code=') || window.location.search.includes('code=')) {
      await this.handleCallback()
    }
  }

  async login() {
    const state = this.generateState()
    const codeVerifier = this.generateCodeVerifier()
    const codeChallenge = await this.generateCodeChallenge(codeVerifier)
    
    sessionStorage.setItem('oauth_state', state)
    sessionStorage.setItem('oauth_code_verifier', codeVerifier)

    const params = new URLSearchParams({
      client_id: this.config.clientId,
      response_type: 'code',
      redirect_uri: this.config.redirectUri,
      scope: this.scope,
      state: state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      access_type: 'offline',
      prompt: 'consent'
    })

    const authUrl = `${this.authUrl}?${params}`
    
    return new Promise((resolve, reject) => {
      this.loginResolve = resolve
      this.loginReject = reject
      window.location.href = authUrl
    })
  }

  async handleCallback() {
    const urlParams = new URLSearchParams(window.location.search)
    const code = urlParams.get('code')
    const state = urlParams.get('state')
    const error = urlParams.get('error')

    if (error) {
      const errorDescription = urlParams.get('error_description')
      throw new Error(`OAuth error: ${error} - ${errorDescription}`)
    }

    const storedState = sessionStorage.getItem('oauth_state')
    const codeVerifier = sessionStorage.getItem('oauth_code_verifier')

    if (!state || state !== storedState) {
      throw new Error('Invalid state parameter')
    }

    sessionStorage.removeItem('oauth_state')
    sessionStorage.removeItem('oauth_code_verifier')

    if (code) {
      const tokenData = await this.exchangeCodeForTokens(code, codeVerifier)
      const userInfo = await this.getUserInfo(tokenData.access_token)
      
      return {
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        expiresIn: tokenData.expires_in,
        userInfo: userInfo
      }
    }

    throw new Error('No authorization code received')
  }

  async exchangeCodeForTokens(code, codeVerifier) {
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
      grant_type: 'authorization_code',
      code: code,
      redirect_uri: this.config.redirectUri,
      code_verifier: codeVerifier
    })

    const response = await fetch(this.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(`Token exchange failed: ${error.error_description || error.error}`)
    }

    return await response.json()
  }

  async getUserInfo(accessToken) {
    const response = await fetch(this.userInfoUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      throw new Error('Failed to fetch user info')
    }

    const userData = await response.json()
    
    return {
      id: userData.id,
      email: userData.email,
      name: userData.name,
      provider: 'google',
      avatar: userData.picture
    }
  }

  async refreshToken(refreshToken) {
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
      grant_type: 'refresh_token',
      refresh_token: refreshToken
    })

    const response = await fetch(this.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(`Token refresh failed: ${error.error_description || error.error}`)
    }

    const tokenData = await response.json()
    
    return {
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token || refreshToken,
      expiresIn: tokenData.expires_in
    }
  }

  async logout() {
    const logoutUrl = `https://accounts.google.com/logout`
    window.open(logoutUrl, '_blank', 'width=1,height=1')
  }
}
