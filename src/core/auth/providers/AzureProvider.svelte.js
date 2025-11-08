import { AuthProvider } from '@/core/auth/AuthProvider.svelte.js'
import { authDebug, authError, authWarn } from '@/core/auth/authLogging.svelte.js'

export class AzureProvider extends AuthProvider {
  constructor(config) {
    super('azure', 'Microsoft Azure AD', config)
    this.authUrl = 'https://login.microsoftonline.com'
    // Utiliser les scopes de la config, sinon fallback sur les scopes minimaux
    this.scope = config.scopes || 'openid profile email User.Read'
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
      authDebug('Azure token exchange successful', {
        hasAccessToken: Boolean(tokenData.access_token),
        hasIdToken: Boolean(tokenData.id_token),
        hasRefreshToken: Boolean(tokenData.refresh_token),
        scope: tokenData.scope
      })
      
      // Extraire les infos utilisateur de l'ID Token
      authDebug('Extracting user info from ID token')
      const userInfo = this.getUserInfoFromIdToken(tokenData.id_token)
      authDebug('Azure user info extracted', {
        hasEmail: Boolean(userInfo.email),
        hasName: Boolean(userInfo.name),
        sub: userInfo.sub
      })
      
      // Préparer les tokens (Azure peut retourner plusieurs audiences si multiples scopes)
      const accessTokens = []
      const scopesList = (tokenData.scope || this.scope).split(' ')
      
      // Azure retourne UN SEUL access_token mais avec une audience spécifique
      // Extraire l'audience pour déterminer à quoi sert ce token
      const audience = this.extractAudienceFromToken(tokenData.access_token)
      
      accessTokens.push({
        accessToken: tokenData.access_token,
        audience: audience,
        scopes: scopesList,
        expiresIn: tokenData.expires_in
      })
      
      // 🔄 WORKAROUND : Azure retourne un seul token même avec plusieurs scopes
      // Si le token reçu n'est pas pour notre API custom, on utilise le refresh token
      // pour obtenir un token avec la bonne audience
      const customApiScopes = this.scope.split(' ').filter(s => s.startsWith('api://'))
      
      authDebug('Checking for custom API scopes', {
        allScopes: this.scope,
        customApiScopes,
        customApiScopesCount: customApiScopes.length,
        currentAudience: audience
      })
      
      if (customApiScopes.length > 0) {
        const expectedAudience = customApiScopes[0].split('/').slice(0, 3).join('/')
        
        authDebug('Evaluating if refresh is needed', {
          audience,
          expectedAudience,
          isGraphAPI: audience === '00000003-0000-0000-c000-000000000000',
          needsRefresh: audience !== expectedAudience && audience === '00000003-0000-0000-c000-000000000000'
        })
        
        if (audience !== expectedAudience && audience === '00000003-0000-0000-c000-000000000000') {
          // Le token reçu est pour Graph API, pas pour notre API
          authDebug('Token received is for Graph API, requesting custom API token with refresh', {
            currentAudience: audience,
            expectedAudience: expectedAudience
          })
          
          try {
            // Utiliser le refresh token immédiatement pour obtenir un token avec les bons scopes
            const customTokenData = await this.refreshTokenWithScopes(tokenData.refresh_token, customApiScopes.join(' '))
            if (customTokenData) {
              const customAudience = this.extractAudienceFromToken(customTokenData.access_token)
              accessTokens.push({
                accessToken: customTokenData.access_token,
                audience: customAudience,
                scopes: customApiScopes,
                expiresIn: customTokenData.expires_in
              })
              authDebug('Custom API token obtained via refresh', {
                audience: customAudience,
                scopes: customApiScopes
              })
            }
          } catch (refreshError) {
            authWarn('Failed to obtain custom API token via refresh', refreshError)
            // Non-bloquant : on continue avec le token Graph
          }
        }
      }
      
      authDebug('Azure callback processed successfully', {
        tokenCount: accessTokens.length,
        audiences: accessTokens.map(t => t.audience)
      })
      
      return {
        success: true,
        tokens: {
          accessTokens: accessTokens, // Format multi-tokens
          refreshToken: tokenData.refresh_token,
          idToken: tokenData.id_token
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

  /**
   * Décode un JWT pour extraire son audience
   */
  extractAudienceFromToken(token) {
    try {
      const parts = token.split('.')
      if (parts.length !== 3) {
        return 'unknown'
      }
      
      const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')))
      return payload.aud || 'unknown'
    } catch (error) {
      authWarn('Failed to extract audience from token', error)
      return 'unknown'
    }
  }

  /**
   * Extrait les infos utilisateur de l'ID Token (pas besoin d'appeler Graph API)
   */
  getUserInfoFromIdToken(idToken) {
    try {
      const parts = idToken.split('.')
      if (parts.length !== 3) {
        throw new Error('Invalid ID token format')
      }
      
      const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')))
      
      authDebug('ID Token payload decoded', {
        oid: payload.oid,
        preferred_username: payload.preferred_username,
        name: payload.name
      })
      
      return {
        sub: payload.oid,        // Object ID Azure AD (identifiant unique)
        id: payload.oid,         // Compatibilité
        email: payload.email || payload.preferred_username,
        name: payload.name,
        provider: 'azure',
        avatar: null // Avatar chargé séparément si besoin
      }
    } catch (error) {
      authError('Failed to decode ID token', error)
      throw new Error('Failed to extract user info from ID token')
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
    
    let avatar = null
    try {
      const photoResponse = await fetch('https://graph.microsoft.com/v1.0/me/photo/$value', {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      })
      
      if (photoResponse.ok) {
        const photoBlob = await photoResponse.blob()
        avatar = URL.createObjectURL(photoBlob)
      }
    } catch (photoError) {
      authDebug('Azure user profile photo unavailable')
    }
    
    return {
      id: userData.id,
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

  /**
   * Utilise le refresh token pour obtenir un access token avec des scopes spécifiques
   * C'est la méthode recommandée pour obtenir plusieurs tokens dans une SPA
   * @param {string} refreshToken - Le refresh token obtenu lors du login initial
   * @param {string} scopes - Les scopes spécifiques à demander
   * @returns {Promise<{access_token: string, expires_in: number}>}
   */
  async refreshTokenWithScopes(refreshToken, scopes) {
    authDebug('Requesting token with specific scopes via refresh', { scopes })
    
    const tokenEndpoint = `${this.authUrl}/${this.config.tenantId}/oauth2/v2.0/token`
    
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      scope: scopes // Scopes spécifiques pour la nouvelle audience
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
      authError('Token refresh with scopes failed', {
        status: response.status,
        error,
        requestedScopes: scopes
      })
      throw new Error(`Token refresh failed: ${error.error_description || error.error}`)
    }

    const tokenData = await response.json()
    authDebug('Token with specific scopes obtained', {
      scopes,
      hasAccessToken: Boolean(tokenData.access_token)
    })
    
    return tokenData
  }
}