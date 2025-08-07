import { AuthProvider } from '@/core/auth/AuthProvider.svelte.js'

export class AzureProvider extends AuthProvider {
  constructor(config) {
    super('azure', 'Microsoft Azure AD', config)
    this.authUrl = 'https://login.microsoftonline.com'
    this.scope = 'openid profile email User.Read'
  }

  requiredConfigKeys() {
    return ['clientId', 'tenantId']
  }

  async initialize() {
    await super.initialize()
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
      code_challenge_method: 'S256'
    })

    const authUrl = `${this.authUrl}/${this.config.tenantId}/oauth2/v2.0/authorize?${params}`
    console.log(`Azure OAuth: Redirecting to ${authUrl}`)
    
    window.location.href = authUrl
    
    return {
      success: true,
      redirected: true
    }
  }

  async handleOwnCallback() {
    console.log('AzureProvider.handleOwnCallback started')
    
    const urlParams = new URLSearchParams(window.location.search)
    const code = urlParams.get('code')
    const state = urlParams.get('state')
    const error = urlParams.get('error')

    console.log('Azure callback received:', { code: !!code, state, error })

    if (error) {
      const errorDescription = urlParams.get('error_description')
      console.error('Azure OAuth error:', { error, errorDescription })
      return {
        success: false,
        error: `OAuth error: ${error} - ${errorDescription}`
      }
    }

    const storedState = sessionStorage.getItem(this.getStorageKey('state'))
    const codeVerifier = sessionStorage.getItem(this.getStorageKey('code_verifier'))
    
    console.log('Azure state validation:', { receivedState: state, storedState, codeVerifier: !!codeVerifier })

    if (!state || state !== storedState) {
      console.error('Azure state mismatch:', { received: state, stored: storedState })
      return {
        success: false,
        error: 'Invalid state parameter - possible CSRF attack'
      }
    }

    if (!code) {
      console.error('No authorization code received from Azure')
      return {
        success: false,
        error: 'No authorization code received'
      }
    }

    sessionStorage.removeItem(this.getStorageKey('state'))
    sessionStorage.removeItem(this.getStorageKey('code_verifier'))

    try {
      console.log('Exchanging Azure code for tokens...')
      const tokenData = await this.exchangeCodeForTokens(code, codeVerifier)
      console.log('Azure token exchange successful')
      
      console.log('Fetching Azure user info...')
      const userInfo = await this.getUserInfo(tokenData.access_token)
      console.log('Azure user info received:', userInfo)
      
      console.log('AzureProvider.handleOwnCallback completed successfully')
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
      console.error('Azure callback processing error:', err)
      return {
        success: false,
        error: err.message
      }
    }
  }

  async exchangeCodeForTokens(code, codeVerifier) {
    const tokenEndpoint = `${this.authUrl}/${this.config.tenantId}/oauth2/v2.0/token`
    
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      grant_type: 'authorization_code',
      code: code,
      redirect_uri: this.getRedirectUri(),
      code_verifier: codeVerifier
    })

    const response = await fetch(tokenEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params
    })

    if (!response.ok) {
      const error = await response.json()
      console.error('Azure token exchange failed:', {
        status: response.status,
        statusText: response.statusText,
        error: error,
        endpoint: tokenEndpoint,
        clientId: this.config.clientId,
        tenantId: this.config.tenantId,
        redirectUri: this.getRedirectUri()
      })
      throw new Error(`Token exchange failed: ${error.error_description || error.error}`)
    }

    return await response.json()
  }

  async getUserInfo(accessToken) {
    const response = await fetch('https://graph.microsoft.com/v1.0/me', {
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
      email: userData.mail || userData.userPrincipalName,
      name: userData.displayName,
      provider: 'azure',
      avatar: null
    }
  }

  async refreshToken(refreshToken) {
    const tokenEndpoint = `${this.authUrl}/${this.config.tenantId}/oauth2/v2.0/token`
    
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      grant_type: 'refresh_token',
      refresh_token: refreshToken
    })

    const response = await fetch(tokenEndpoint, {
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
    const logoutUrl = `${this.authUrl}/${this.config.tenantId}/oauth2/v2.0/logout?post_logout_redirect_uri=${encodeURIComponent(window.location.origin)}`
    window.location.href = logoutUrl
    return { success: true }
  }
}
