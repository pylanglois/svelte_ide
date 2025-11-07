import { AuthProvider } from '@/core/auth/AuthProvider.svelte.js'
import { authDebug, authWarn, authError } from '@/core/auth/authLogging.svelte.js'
import { avatarCacheService } from '@/core/auth/AvatarCacheService.svelte.js'

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

    authDebug('Google provider config received', {
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

    authDebug('Google provider config evaluated', {
      allowInsecureClientSecret: this.allowInsecureClientSecret,
      storedSecretLength: this.config.clientSecret ? this.config.clientSecret.length : 0
    })

    if (this.allowInsecureClientSecret && import.meta.env && import.meta.env.PROD) {
      authWarn(
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
    let redirectHost = null
    try {
      redirectHost = new URL(authUrl).host
    } catch (_) {
      redirectHost = 'unknown'
    }
    authDebug('Google OAuth redirect initiated', {
      hasBackendExchange: this.useBackendExchange,
      redirectHost
    })
    
    window.location.href = authUrl
    
    return {
      success: true,
      redirected: true
    }
  }

  async handleOwnCallback() {
    authDebug('Google callback started')
    
    const urlParams = new URLSearchParams(window.location.search)
    const code = urlParams.get('code')
    const state = urlParams.get('state')
    const error = urlParams.get('error')

    authDebug('Google callback parameters', { hasCode: !!code, hasState: !!state, error })

    if (error) {
      const errorDescription = urlParams.get('error_description')
      authError('Google OAuth error', { error, errorDescription })
      return {
        success: false,
        error: `OAuth error: ${error} - ${errorDescription}`
      }
    }

    const storedState = this.consumeStoredState()
    const codeVerifier = sessionStorage.getItem(this.getStorageKey('code_verifier'))

    authDebug('Google state validation', { 
      hasUrlState: !!state,
      hasStoredState: !!storedState, 
      stateMatch: state && storedState ? state === storedState : false,
      hasCodeVerifier: !!codeVerifier 
    })

    if (!state || !storedState) {
      authWarn('Google state validation failed: missing or expired state')
      return {
        success: false,
        error: 'Invalid or expired state parameter - possible CSRF attack'
      }
    }

    if (state !== storedState) {
      authWarn('Google state validation failed', { received: state, stored: storedState })
      return {
        success: false,
        error: 'Invalid state parameter - possible CSRF attack'
      }
    }

    if (!code) {
      authWarn('No authorization code received from Google')
      return {
        success: false,
        error: 'No authorization code received'
      }
    }

    sessionStorage.removeItem(this.getStorageKey('code_verifier'))

    try {
      authDebug('Exchanging Google authorization code for tokens')
      const tokenData = await this.exchangeCodeForTokens(code, codeVerifier)
      authDebug('Google token exchange successful')
      
      authDebug('Fetching Google user info')
      const userInfo = await this.getUserInfo(tokenData.access_token)
      authDebug('Google user info received', {
        hasEmail: Boolean(userInfo.email),
        hasName: Boolean(userInfo.name),
        hasAvatar: Boolean(userInfo.avatar)
      })
      
      authDebug('Google callback processed successfully')
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
      authError('Google callback processing error', err)
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
        authError('Google backend token exchange failed', error)
        const message =
          (error && (error.error_description || error.error || error.message)) ||
          'Backend token exchange failed'
        throw new Error(message)
      }

      authDebug('Google token exchange completed via backend')
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

    authDebug('Google token exchange payload (direct)', {
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
      authError('Google token exchange failed (direct)', error)
      const message =
        (error && (error.error_description || error.error || error.message)) ||
        'Token exchange failed'
      throw new Error(message)
    }

    authDebug('Google token exchange completed via direct flow', {
      backend: false,
      includeSecret
    })
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
    
    authDebug('Raw Google user data received', {
      hasId: Boolean(userData.sub || userData.id),
      hasEmail: Boolean(userData.email),
      hasPicture: Boolean(userData.picture)
    })
    
    const userId = userData.sub || userData.id
    let avatar = null
    
    // Google retourne directement une URL d'image (pas besoin de télécharger)
    // Mais on peut la mettre en cache pour réduire les requêtes réseau
    if (userData.picture) {
      // Essayer de récupérer depuis le cache
      avatar = await avatarCacheService.getAvatar(userId)
      
      if (avatar) {
        authDebug('Google user avatar restored from cache')
      } else {
        // Télécharger l'image et la mettre en cache
        try {
          const pictureResponse = await fetch(userData.picture)
          if (pictureResponse.ok) {
            const pictureBlob = await pictureResponse.blob()
            avatar = await avatarCacheService.saveAvatar(userId, pictureBlob)
            authDebug('Google user avatar downloaded and cached')
          } else {
            // Fallback: utiliser l'URL directe si téléchargement échoue
            avatar = userData.picture
            authDebug('Google avatar fetch failed, using direct URL')
          }
        } catch (error) {
          // Fallback: utiliser l'URL directe
          avatar = userData.picture
          authDebug('Google avatar download failed, using direct URL', error)
        }
      }
    }
    
    // Google retourne 'sub' (subject) selon le standard OAuth2/OIDC
    // On normalise pour garantir que 'sub' est toujours présent
    return {
      sub: userId,         // Standard OAuth2/OIDC
      id: userId,          // Compatibilité descendante
      email: userData.email,
      name: userData.name,
      provider: 'google',
      avatar: avatar
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
        authError('Google backend token refresh failed', error)
        const message =
          (error && (error.error_description || error.error || error.message)) ||
          'Token refresh failed'
        return {
          success: false,
          error: message
        }
      }

      const tokenData = await response.json()
      authDebug('Google token refresh completed via backend')
      
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

    authDebug('Google token refresh payload (direct)', {
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
