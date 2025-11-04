import { AuthProvider } from '@/core/auth/AuthProvider.svelte.js'

export class GoogleProvider extends AuthProvider {
  constructor(config) {
    super('google', 'Google', config)
    this.authUrl = 'https://accounts.google.com/o/oauth2/v2/auth'
    this.tokenUrl = 'https://oauth2.googleapis.com/token'
    this.userInfoUrl = 'https://openidconnect.googleapis.com/v1/userinfo'
    this.scope = 'openid profile email'
    this.useBackendExchange = false
    this.backendTokenUrl = null
    this.backendRefreshUrl = null
    this.backendHeaders = {}
    this.backendCredentials = 'include'
    this.allowInsecureClientSecret = false
  }

  requiredConfigKeys() {
    return ['clientId']
  }

  validateConfig() {
    super.validateConfig()

    if (!this.isConfigured) {
      return
    }

    const secret =
      typeof this.config.clientSecret === 'string' ? this.config.clientSecret.trim() : ''

    const allowSecretFlag =
      this.config.allowInsecureClientSecret === true ||
      this.config.allowInsecureClientSecret === 'true' ||
      this.config.allowInsecureClientSecret === '1'

    console.log('GoogleProvider.validateConfig', {
      receivedClientSecret: !!this.config.clientSecret,
      trimmedSecretLength: secret.length,
      allowSecretFlag
    })

    this.allowInsecureClientSecret = allowSecretFlag && !!secret

    if (secret && !this.allowInsecureClientSecret) {
      throw new Error(
        'GoogleProvider: clientSecret detected but allowInsecureClientSecret is not enabled. Remove the secret or enable a backend exchange.'
      )
    }

    if (this.allowInsecureClientSecret) {
      this.config.clientSecret = secret
    } else {
      delete this.config.clientSecret
    }

    console.log('GoogleProvider.validateConfig status', {
      allowInsecureClientSecret: this.allowInsecureClientSecret,
      storedSecretLength: this.config.clientSecret ? this.config.clientSecret.length : 0
    })

    if (this.allowInsecureClientSecret && import.meta.env && import.meta.env.PROD) {
      console.warn(
        'GoogleProvider: allowInsecureClientSecret enabled in production build. This exposes the client secret; consider switching to the backend exchange.'
      )
    }

    const wantsBackend =
      this.config.useBackendExchange === true ||
      (typeof this.config.useBackendExchange === 'string' &&
        (this.config.useBackendExchange.toLowerCase() === 'true' || this.config.useBackendExchange === '1'))

    const backendTokenUrl =
      typeof this.config.backendTokenUrl === 'string'
        ? this.config.backendTokenUrl.trim()
        : null
    const backendRefreshUrl =
      typeof this.config.backendRefreshUrl === 'string'
        ? this.config.backendRefreshUrl.trim()
        : null

    this.useBackendExchange = wantsBackend || !!backendTokenUrl || !!backendRefreshUrl
    this.backendTokenUrl = backendTokenUrl || null
    this.backendRefreshUrl = backendRefreshUrl || backendTokenUrl || null

    if (this.useBackendExchange && !this.backendTokenUrl) {
      this.isConfigured = false
      throw new Error('GoogleProvider: backend exchange enabled but backendTokenUrl is missing')
    }

    if (this.useBackendExchange) {
      const headers =
        this.config.backendHeaders && typeof this.config.backendHeaders === 'object'
          ? this.config.backendHeaders
          : null
      this.backendHeaders = headers ? { ...headers } : {}

      if (this.config.backendCredentials !== undefined) {
        if (typeof this.config.backendCredentials === 'boolean') {
          this.backendCredentials = this.config.backendCredentials ? 'include' : 'omit'
        } else if (typeof this.config.backendCredentials === 'string') {
          this.backendCredentials = this.config.backendCredentials
        }
      }
    }
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
    
    this.storeState(state)
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

    console.log('Google callback parameters:', { hasCode: !!code, hasState: !!state, error })

    if (error) {
      const errorDescription = urlParams.get('error_description')
      console.error('Google OAuth error:', error, errorDescription)
      return {
        success: false,
        error: `OAuth error: ${error} - ${errorDescription}`
      }
    }

    const storedState = this.consumeStoredState()
    const codeVerifier = sessionStorage.getItem(this.getStorageKey('code_verifier'))

    console.log('Google state validation:', { 
      hasUrlState: !!state,
      hasStoredState: !!storedState, 
      stateMatch: state && storedState ? state === storedState : false,
      hasCodeVerifier: !!codeVerifier 
    })

    if (!state || !storedState) {
      console.error('Google state validation failed: missing or expired state')
      return {
        success: false,
        error: 'Invalid or expired state parameter - possible CSRF attack'
      }
    }

    if (state !== storedState) {
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
    if (this.useBackendExchange) {
      const response = await fetch(this.backendTokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...this.backendHeaders
        },
        credentials: this.backendCredentials,
        body: JSON.stringify({
          code,
          codeVerifier,
          redirectUri: this.getRedirectUri(),
          clientId: this.config.clientId,
          provider: this.id
        })
      })

      if (!response.ok) {
        let error
        try {
          error = await response.json()
        } catch (_) {
          error = await response.text()
        }
        console.error('GoogleProvider: Backend token exchange failed:', error)
        const message =
          (error && (error.error_description || error.error || error.message)) ||
          'Backend token exchange failed'
        throw new Error(message)
      }

      console.log('GoogleProvider: Token exchange completed via backend')
      return await response.json()
    }

    const params = new URLSearchParams({
      client_id: this.config.clientId,
      grant_type: 'authorization_code',
      code: code,
      redirect_uri: this.getRedirectUri(),
      code_verifier: codeVerifier
    })

    const directSecret = this.config.clientSecret
    const includeSecret = typeof directSecret === 'string' && directSecret.length > 0

    if (includeSecret) {
      params.set('client_secret', directSecret)
    }

    console.log('GoogleProvider: Token exchange payload (direct)', {
      hasSecret: params.has('client_secret'),
      allowInsecureClientSecret: this.allowInsecureClientSecret,
      configHasSecret: includeSecret
    })

    const response = await fetch(this.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params
    })

    if (!response.ok) {
      let error
      try {
        error = await response.json()
      } catch (_) {
        error = await response.text()
      }
      console.error('GoogleProvider: Token exchange failed:', error)
      const message =
        (error && (error.error_description || error.error || error.message)) ||
        'Token exchange failed'
      throw new Error(message)
    }

    console.log('GoogleProvider: Token exchange completed via direct flow')
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
    if (this.useBackendExchange) {
      const response = await fetch(this.backendRefreshUrl || this.backendTokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...this.backendHeaders
        },
        credentials: this.backendCredentials,
        body: JSON.stringify({
          refreshToken,
          clientId: this.config.clientId,
          provider: this.id
        })
      })

      if (!response.ok) {
        let error
        try {
          error = await response.json()
        } catch (_) {
          error = await response.text()
        }
        console.error('GoogleProvider: Backend token refresh failed:', error)
        const message =
          (error && (error.error_description || error.error || error.message)) ||
          'Token refresh failed'
        return {
          success: false,
          error: message
        }
      }

      const tokenData = await response.json()
      console.log('GoogleProvider: Token refresh completed via backend')
      
      return {
        success: true,
        tokens: {
          accessToken: tokenData.access_token,
          refreshToken: tokenData.refresh_token || refreshToken,
          expiresIn: tokenData.expires_in
        }
      }
    }

    const params = new URLSearchParams({
      client_id: this.config.clientId,
      grant_type: 'refresh_token',
      refresh_token: refreshToken
    })

    const directSecret = this.config.clientSecret
    const includeSecret = typeof directSecret === 'string' && directSecret.length > 0

    if (includeSecret) {
      params.set('client_secret', directSecret)
    }

    console.log('GoogleProvider: Token refresh payload (direct)', {
      hasSecret: params.has('client_secret'),
      allowInsecureClientSecret: this.allowInsecureClientSecret,
      configHasSecret: includeSecret
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
