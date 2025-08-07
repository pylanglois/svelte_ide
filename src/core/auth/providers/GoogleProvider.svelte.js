import { AuthProvider } from '@/core/auth/AuthProvider.svelte.js'

export class GoogleProvider extends AuthProvider {
  constructor(config) {
    super('google', 'Google', config)
    this.authUrl = 'https://accounts.google.com/o/oauth2/v2/auth'
    this.tokenUrl = 'https://oauth2.googleapis.com/token'
    this.userInfoUrl = 'https://openidconnect.googleapis.com/v1/userinfo'
    this.scope = 'openid profile email'
  }

  requiredConfigKeys() {
    // Google exige client_secret même pour Desktop apps maintenant
    return ['clientId', 'clientSecret']
  }

  async initialize() {
    await super.initialize()
    // Ne pas traiter automatiquement les callbacks ici
    // Laisser authStore.handleOAuthCallback() s'en charger
  }

  async login() {
    const state = this.generateState()
    const codeVerifier = this.generateCodeVerifier()
    const codeChallenge = await this.generateCodeChallenge(codeVerifier)
    
    sessionStorage.setItem(this.getStorageKey('state'), state)
    sessionStorage.setItem(this.getStorageKey('code_verifier'), codeVerifier)

    const params = new URLSearchParams({
      client_id: this.config.clientId,
      response_type: 'code',
      redirect_uri: this.getRedirectUri(),
      scope: this.scope,
      state: state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      access_type: 'offline',
      prompt: 'consent'
    })

    const authUrl = `${this.authUrl}?${params}`
    console.log(`Google OAuth: Redirecting to ${authUrl}`)
    
    window.location.href = authUrl
    
    return {
      success: true,
      redirected: true
    }
  }

  async handleOwnCallback() {
    console.log('GoogleProvider.handleOwnCallback started')
    
    const urlParams = new URLSearchParams(window.location.search)
    const code = urlParams.get('code')
    const state = urlParams.get('state')
    const error = urlParams.get('error')

    console.log('Google callback parameters:', { code: !!code, state, error })

    if (error) {
      const errorDescription = urlParams.get('error_description')
      console.error('Google OAuth error:', error, errorDescription)
      return {
        success: false,
        error: `OAuth error: ${error} - ${errorDescription}`
      }
    }

    const storedState = sessionStorage.getItem(this.getStorageKey('state'))
    const codeVerifier = sessionStorage.getItem(this.getStorageKey('code_verifier'))

    console.log('Google state validation:', { 
      urlState: state, 
      storedState, 
      stateMatch: state === storedState,
      hasCodeVerifier: !!codeVerifier 
    })

    if (!state || state !== storedState) {
      console.error('Google state validation failed')
      return {
        success: false,
        error: 'Invalid state parameter - possible CSRF attack'
      }
    }

    if (!code) {
      console.error('No authorization code received from Google')
      return {
        success: false,
        error: 'No authorization code received'
      }
    }

    sessionStorage.removeItem(this.getStorageKey('state'))
    sessionStorage.removeItem(this.getStorageKey('code_verifier'))

    try {
      console.log('Exchanging Google code for tokens...')
      const tokenData = await this.exchangeCodeForTokens(code, codeVerifier)
      console.log('Google token exchange successful')
      
      console.log('Fetching Google user info...')
      const userInfo = await this.getUserInfo(tokenData.access_token)
      console.log('Google user info received:', userInfo)
      
      console.log('GoogleProvider.handleOwnCallback completed successfully')
      return {
        success: true,
        tokens: {
          accessToken: tokenData.access_token,
          refreshToken: tokenData.refresh_token,
          expiresIn: tokenData.expires_in
        },
        userInfo: userInfo
      }
    } catch (err) {
      console.error('Google callback processing error:', err)
      return {
        success: false,
        error: err.message
      }
    }
  }

  async exchangeCodeForTokens(code, codeVerifier) {
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
      grant_type: 'authorization_code',
      code: code,
      redirect_uri: this.getRedirectUri(),
      code_verifier: codeVerifier
    })

    console.log('GoogleProvider: Token exchange avec PKCE + client_secret (Google policy 2025)')

    const response = await fetch(this.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params
    })

    if (!response.ok) {
      const error = await response.json()
      console.error('GoogleProvider: Token exchange failed:', error)
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
    
    console.log('Google user data received:', userData)
    
    return {
      id: userData.sub || userData.id,
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

    console.log('GoogleProvider: Refresh token avec client_secret (Google policy 2025)')

    const response = await fetch(this.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params
    })

    if (!response.ok) {
      const error = await response.json()
      return {
        success: false,
        error: `Token refresh failed: ${error.error_description || error.error}`
      }
    }

    const tokenData = await response.json()
    
    return {
      success: true,
      tokens: {
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token || refreshToken,
        expiresIn: tokenData.expires_in
      }
    }
  }

  async logout() {
    const logoutUrl = `https://accounts.google.com/logout`
    window.open(logoutUrl, '_blank', 'width=1,height=1')
  }
}
