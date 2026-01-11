import { createLogger } from '../../../lib/logger.js'
import { AuthProvider } from '../AuthProvider.svelte.js'
import { avatarCacheService } from '../AvatarCacheService.svelte.js'

const logger = createLogger('core/auth/azure-provider')

export class AzureProvider extends AuthProvider {
  static fromEnv(env) {
    const clientId = typeof env?.VITE_AZURE_CLIENT_ID === 'string'
      ? env.VITE_AZURE_CLIENT_ID.trim()
      : ''
    const tenantId = typeof env?.VITE_AZURE_TENANT_ID === 'string'
      ? env.VITE_AZURE_TENANT_ID.trim()
      : ''
    const scopes = typeof env?.VITE_AZURE_SCOPES === 'string'
      ? env.VITE_AZURE_SCOPES.trim()
      : ''

    if (!clientId || !tenantId) {
      throw new Error('AuthStore: Azure provider requires VITE_AZURE_CLIENT_ID and VITE_AZURE_TENANT_ID')
    }

    const config = { clientId, tenantId }
    if (scopes) {
      config.scopes = scopes
    }

    return new AzureProvider(config)
  }

  constructor(config) {
    super('azure', 'Microsoft Azure AD', config)
    this.authUrl = 'https://login.microsoftonline.com'
    
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
    logger.debug('Azure OAuth redirect initiated', {
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
    logger.debug('Azure callback started')
    
    const urlParams = new URLSearchParams(window.location.search)
    const code = urlParams.get('code')
    const state = urlParams.get('state')
    const error = urlParams.get('error')

    logger.debug('Azure callback parameters', { hasCode: !!code, hasState: !!state, error })

    if (error) {
      const errorDescription = urlParams.get('error_description')
      logger.error('Azure OAuth error', { error, errorDescription })
      return {
        success: false,
        error: `OAuth error: ${error} - ${errorDescription}`
      }
    }

    const storedState = sessionStorage.getItem(this.getStorageKey('state'))
    const codeVerifier = sessionStorage.getItem(this.getStorageKey('code_verifier'))
    
    logger.debug('Azure state validation', {
      hasState: !!state,
      hasStoredState: !!storedState,
      stateMatch: state && storedState ? state === storedState : false,
      hasCodeVerifier: !!codeVerifier
    })

    if (!state || state !== storedState) {
      logger.warn('Azure state mismatch', { received: state, stored: storedState })
      return {
        success: false,
        error: 'Invalid state parameter - possible CSRF attack'
      }
    }

    if (!code) {
      logger.warn('No authorization code received from Azure')
      return {
        success: false,
        error: 'No authorization code received'
      }
    }

    sessionStorage.removeItem(this.getStorageKey('state'))
    sessionStorage.removeItem(this.getStorageKey('code_verifier'))

    try {
      logger.debug('Exchanging Azure authorization code for tokens')
      const tokenData = await this.exchangeCodeForTokens(code, codeVerifier)
      logger.debug('Azure token exchange successful', {
        hasAccessToken: Boolean(tokenData.access_token),
        hasIdToken: Boolean(tokenData.id_token),
        hasRefreshToken: Boolean(tokenData.refresh_token),
        scope: tokenData.scope
      })

      this.logRefreshTokenExpiry(tokenData, 'initial-login')
      
      
      logger.debug('Extracting user info from ID token')
      const userInfo = this.getUserInfoFromIdToken(tokenData.id_token)
      logger.debug('Azure user info extracted', {
        hasEmail: Boolean(userInfo.email),
        hasName: Boolean(userInfo.name),
        sub: userInfo.sub
      })
      
      
      try {
        const avatarUrl = await this.loadUserAvatar(userInfo.sub, tokenData.access_token, tokenData.refresh_token)
        if (avatarUrl) {
          userInfo.avatar = avatarUrl
          logger.debug('Azure avatar loaded successfully', { hasAvatar: true })
        }
      } catch (avatarErr) {
        logger.debug('Failed to load Azure avatar (non-blocking)', avatarErr)
        
      }
      
      
      const accessTokens = []
      const scopesList = (tokenData.scope || this.scope).split(' ')
      
      
      
      const audience = this.extractAudienceFromToken(tokenData.access_token)
      
      accessTokens.push({
        accessToken: tokenData.access_token,
        audience: audience,
        scopes: scopesList,
        expiresIn: tokenData.expires_in
      })
      
      
      
      
      const customApiScopes = this.scope.split(' ').filter(s => s.startsWith('api://'))
      
      logger.debug('Checking for custom API scopes', {
        allScopes: this.scope,
        customApiScopes,
        customApiScopesCount: customApiScopes.length,
        currentAudience: audience
      })
      
      if (customApiScopes.length > 0) {
        const expectedAudience = customApiScopes[0].split('/').slice(0, 3).join('/')
        
        logger.debug('Evaluating if refresh is needed', {
          audience,
          expectedAudience,
          isGraphAPI: audience === '00000003-0000-0000-c000-000000000000',
          needsRefresh: audience !== expectedAudience && audience === '00000003-0000-0000-c000-000000000000'
        })
        
        if (audience !== expectedAudience && audience === '00000003-0000-0000-c000-000000000000') {
          
          logger.debug('Token received is for Graph API, requesting custom API token with refresh', {
            currentAudience: audience,
            expectedAudience: expectedAudience
          })
          
          try {
            
            const customTokenData = await this.refreshTokenWithScopes(tokenData.refresh_token, customApiScopes.join(' '))
            if (customTokenData) {
              const customAudience = this.extractAudienceFromToken(customTokenData.access_token)
              accessTokens.push({
                accessToken: customTokenData.access_token,
                audience: customAudience,
                scopes: customApiScopes,
                expiresIn: customTokenData.expires_in
              })
              logger.debug('Custom API token obtained via refresh', {
                audience: customAudience,
                scopes: customApiScopes
              })
            }
          } catch (refreshError) {
            logger.warn('Failed to obtain custom API token via refresh', refreshError)
            
          }
        }
      }
      
      logger.debug('Azure callback processed successfully', {
        tokenCount: accessTokens.length,
        audiences: accessTokens.map(t => t.audience)
      })
      
      return {
        success: true,
        tokens: {
          accessTokens: accessTokens, 
          refreshToken: tokenData.refresh_token,
          idToken: tokenData.id_token
        },
        userInfo: userInfo
      }
    } catch (err) {
      logger.error('Azure callback processing error', err)
      return {
        success: false,
        error: err.message
      }
    }
  }

  
  extractAudienceFromToken(token) {
    try {
      const parts = token.split('.')
      if (parts.length !== 3) {
        return 'unknown'
      }
      
      const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')))
      return payload.aud || 'unknown'
    } catch (error) {
      logger.warn('Failed to extract audience from token', error)
      return 'unknown'
    }
  }

  
  getUserInfoFromIdToken(idToken) {
    try {
      const parts = idToken.split('.')
      if (parts.length !== 3) {
        throw new Error('Invalid ID token format')
      }
      
      const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')))
      
      logger.debug('ID Token payload decoded', {
        oid: payload.oid,
        preferred_username: payload.preferred_username,
        name: payload.name
      })
      
      return {
        sub: payload.oid,        
        id: payload.oid,         
        email: payload.email || payload.preferred_username,
        name: payload.name,
        provider: 'azure',
        avatar: null 
      }
    } catch (error) {
      logger.error('Failed to decode ID token', error)
      throw new Error('Failed to extract user info from ID token')
    }
  }

  
  async loadUserAvatar(userId, accessToken, refreshToken) {
    try {
      
      let avatar = await avatarCacheService.getAvatar(userId)
      
      if (avatar) {
        logger.debug('Azure user avatar restored from cache')
        return avatar
      }
      
      
      const audience = this.extractAudienceFromToken(accessToken)
      let graphToken = accessToken
      
      
      if (audience !== '00000003-0000-0000-c000-000000000000') {
        logger.debug('Access token is not for Graph API, requesting Graph token', { 
          currentAudience: audience 
        })
        
        try {
          const graphTokenData = await this.refreshTokenWithScopes(
            refreshToken, 
            'https://graph.microsoft.com/User.Read'
          )
          graphToken = graphTokenData.access_token
          logger.debug('Graph API token obtained for avatar download (temporary, not stored)')
        } catch (refreshError) {
          logger.warn('Failed to obtain Graph token for avatar', refreshError)
          return null
        }
      }
      
      
      const photoResponse = await fetch('https://graph.microsoft.com/v1.0/me/photo/$value', {
        headers: {
          'Authorization': `Bearer ${graphToken}`
        }
      })
      
      if (photoResponse.ok) {
        const photoBlob = await photoResponse.blob()
        avatar = await avatarCacheService.saveAvatar(userId, photoBlob)
        logger.debug('Azure user avatar downloaded and cached')
        return avatar
      } else {
        logger.debug('Azure user profile photo unavailable (HTTP error)', { status: photoResponse.status })
        return null
      }
    } catch (error) {
      logger.debug('Azure user profile photo unavailable (network error)', error)
      return null
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
      logger.error('Azure token exchange failed', {
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
    
    const userId = userData.id
    let avatar = null
    
    
    avatar = await avatarCacheService.getAvatar(userId)
    
    if (avatar) {
      logger.debug('Azure user avatar restored from cache')
    } else {
      
      try {
        const photoResponse = await fetch('https://graph.microsoft.com/v1.0/me/photo/$value', {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        })
        
        if (photoResponse.ok) {
          const photoBlob = await photoResponse.blob()
          avatar = await avatarCacheService.saveAvatar(userId, photoBlob)
          logger.debug('Azure user avatar downloaded and cached')
        } else {
          logger.debug('Azure user profile photo unavailable (HTTP error)', { status: photoResponse.status })
        }
      } catch (photoError) {
        logger.debug('Azure user profile photo unavailable (network error)', photoError)
      }
    }
    
    return {
      sub: userId,         
      id: userId,          
      email: userData.mail || userData.userPrincipalName,
      name: userData.displayName,
      provider: 'azure',
      avatar: avatar
    }
  }

  async refreshToken(refreshToken) {
    const scopeList = (this.scope || '').split(' ').filter(Boolean)
    const customApiScopes = scopeList.filter(scope => scope.startsWith('api://'))
    const graphScopes = scopeList.filter(scope => !scope.startsWith('api://'))

    const accessTokens = []
    let latestRefreshToken = refreshToken

    const pushTokenData = (tokenData, requestedScopes, label) => {
      if (!tokenData?.access_token || !tokenData?.expires_in) {
        logger.warn('Azure refresh did not return an access token', { label })
        return
      }

      const scopes = (tokenData.scope || requestedScopes || '').split(' ').filter(Boolean)
      const audience = this.extractAudienceFromToken(tokenData.access_token)

      accessTokens.push({
        accessToken: tokenData.access_token,
        audience,
        scopes,
        expiresIn: tokenData.expires_in
      })

      if (tokenData.refresh_token) {
        latestRefreshToken = tokenData.refresh_token
      }

      this.logRefreshTokenExpiry(tokenData, label)

      logger.debug('Azure refresh token obtained', {
        label,
        audience,
        scopes,
        hasRefreshToken: Boolean(tokenData.refresh_token)
      })
    }

    try {
      
      if (customApiScopes.length > 0) {
        try {
          const requestedScopes = customApiScopes.join(' ')
          const customTokenData = await this.refreshTokenWithScopes(latestRefreshToken, requestedScopes)
          pushTokenData(customTokenData, requestedScopes, 'custom-api')
        } catch (error) {
          logger.warn('Azure refresh for custom API scopes failed', error)
        }
      }

      
      if (graphScopes.length > 0) {
        try {
          const requestedScopes = graphScopes.join(' ')
          const graphTokenData = await this.refreshTokenWithScopes(latestRefreshToken, requestedScopes)
          pushTokenData(graphTokenData, requestedScopes, 'graph-api')
        } catch (error) {
          logger.warn('Azure refresh for graph scopes failed', error)
        }
      }

      
      if (accessTokens.length === 0) {
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
    
        const fallbackTokenData = await response.json()
        pushTokenData(fallbackTokenData, fallbackTokenData.scope, 'fallback')
      }

      if (accessTokens.length === 0) {
        return {
          success: false,
          error: 'Token refresh failed: no access token returned'
        }
      }

      return {
        success: true,
        tokens: {
          accessTokens,
          refreshToken: latestRefreshToken
        }
      }
    } catch (error) {
      logger.error('Azure token refresh failed', error)
      return {
        success: false,
        error: error.message
      }
    }
  }
  
  logRefreshTokenExpiry(tokenData, context) {
    const expiryInfo = this.computeRefreshTokenExpiry(tokenData)
    if (!expiryInfo) {
      return
    }

    logger.debug('Azure refresh token expiry', {
      context,
      expiresAt: expiryInfo.expiresAt.toLocaleString(),
      remainingSeconds: Math.round(expiryInfo.remainingMs / 1000)
    })
  }

  computeRefreshTokenExpiry(tokenData) {
    if (!tokenData) {
      return null
    }

    const nowSeconds = Math.floor(Date.now() / 1000)
    const expiresIn = Number(tokenData.refresh_token_expires_in)
    const expiresOn = Number(tokenData.refresh_token_expires_on)

    if (Number.isFinite(expiresIn) && expiresIn > 0) {
      const remainingMs = expiresIn * 1000
      return {
        remainingMs,
        expiresAt: new Date(Date.now() + remainingMs)
      }
    }

    if (Number.isFinite(expiresOn) && expiresOn > nowSeconds) {
      const remainingMs = (expiresOn - nowSeconds) * 1000
      return {
        remainingMs,
        expiresAt: new Date(expiresOn * 1000)
      }
    }

    return null
  }

  async logout() {
    const logoutUrl = `${this.authUrl}/${this.config.tenantId}/oauth2/v2.0/logout?post_logout_redirect_uri=${encodeURIComponent(window.location.origin)}`
    
    logger.debug('Azure logout - redirecting to Microsoft', { 
      tenant: this.config.tenantId,
      redirectUri: window.location.origin 
    })
    
    window.location.href = logoutUrl
    
    
    return { success: true, redirected: true }
  }

  
  async refreshTokenWithScopes(refreshToken, scopes) {
    logger.debug('Requesting token with specific scopes via refresh', { scopes })
    
    const tokenEndpoint = `${this.authUrl}/${this.config.tenantId}/oauth2/v2.0/token`
    
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      scope: scopes 
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
      logger.error('Token refresh with scopes failed', {
        status: response.status,
        error,
        requestedScopes: scopes
      })
      throw new Error(`Token refresh failed: ${error.error_description || error.error}`)
    }

    const tokenData = await response.json()
    logger.debug('Token with specific scopes obtained', {
      scopes,
      hasAccessToken: Boolean(tokenData.access_token)
    })
    
    return tokenData
  }
}
