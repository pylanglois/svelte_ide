import { authDebug, authError, authWarn } from '@/core/auth/authLogging.svelte.js'
import { AuthProvider } from '@/core/auth/AuthProvider.svelte.js'
import { avatarCacheService } from '@/core/auth/AvatarCacheService.svelte.js'

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
    let redirectHost = null
    try {
      redirectHost = new URL(authUrl).host
    } catch (_) {
      redirectHost = 'unknown'
    }
    authDebug('Azure OAuth redirect initiated', {
      tenant: this.config.tenantId,
      redirectHost
    })
    
    window.location.href = authUrl
    
    return {
      success: true,
      redirected: true
    }
  }

  async handleOwnCallback() {
    authDebug('Azure callback started')
    
    const urlParams = new URLSearchParams(window.location.search)
    const code = urlParams.get('code')
    const state = urlParams.get('state')
    const error = urlParams.get('error')

    authDebug('Azure callback parameters', { hasCode: !!code, hasState: !!state, error })

    if (error) {
      const errorDescription = urlParams.get('error_description')
      authError('Azure OAuth error', { error, errorDescription })
      return {
        success: false,
        error: `OAuth error: ${error} - ${errorDescription}`
      }
    }

    const storedState = sessionStorage.getItem(this.getStorageKey('state'))
    const codeVerifier = sessionStorage.getItem(this.getStorageKey('code_verifier'))
    
    authDebug('Azure state validation', {
      hasState: !!state,
      hasStoredState: !!storedState,
      stateMatch: state && storedState ? state === storedState : false,
      hasCodeVerifier: !!codeVerifier
    })

    if (!state || state !== storedState) {
      authWarn('Azure state mismatch', { received: state, stored: storedState })
      return {
        success: false,
        error: 'Invalid state parameter - possible CSRF attack'
      }
    }

    if (!code) {
      authWarn('No authorization code received from Azure')
      return {
        success: false,
        error: 'No authorization code received'
      }
    }

    sessionStorage.removeItem(this.getStorageKey('state'))
    sessionStorage.removeItem(this.getStorageKey('code_verifier'))

    try {
      authDebug('Exchanging Azure authorization code for tokens')
      const tokenData = await this.exchangeCodeForTokens(code, codeVerifier)
      authDebug('Azure token exchange successful')
      
      authDebug('Fetching Azure user info')
      const userInfo = await this.getUserInfo(tokenData.access_token)
      authDebug('Azure user info received', {
        hasEmail: Boolean(userInfo.email),
        hasName: Boolean(userInfo.name),
        hasAvatar: Boolean(userInfo.avatar)
      })
      
      authDebug('Azure callback processed successfully')
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
      authError('Azure callback processing error', err)
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
      authError('Azure token exchange failed', {
        status: response.status,
        statusText: response.statusText,
        error,
        endpoint: tokenEndpoint
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
    const userId = userData.id // Utilisé comme clé de cache
    
    // Essayer de récupérer l'avatar depuis le cache
    let avatar = await avatarCacheService.getAvatar(userId)
    
    if (avatar) {
      authDebug('Azure user avatar restored from cache')
    } else {
      // Pas en cache ou expiré → télécharger depuis Graph API
      try {
        const photoResponse = await fetch('https://graph.microsoft.com/v1.0/me/photo/$value', {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        })
        
        if (photoResponse.ok) {
          const photoBlob = await photoResponse.blob()
          // Sauvegarder dans le cache et obtenir l'URL blob
          avatar = await avatarCacheService.saveAvatar(userId, photoBlob)
          authDebug('Azure user avatar downloaded and cached')
        } else {
          authDebug('Azure user profile photo unavailable')
        }
      } catch (photoError) {
        authDebug('Azure user profile photo unavailable', photoError)
      }
    }
    
    // Azure Graph API retourne 'id' (correspond au 'oid' du JWT token)
    // Le standard OAuth2/OIDC utilise 'sub' (subject) pour identifier l'utilisateur
    // On normalise pour compatibilité avec EncryptionKeyDerivation et autres services
    // Note : userData.id (Graph API) === token.oid (JWT) - même valeur, nom différent
    return {
      sub: userData.id,  // Standard OAuth2/OIDC : 'sub' = subject (user unique identifier)
      id: userData.id,   // Gardé pour compatibilité descendante
      email: userData.mail || userData.userPrincipalName,
      name: userData.displayName,
      provider: 'azure',
      avatar: avatar
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
