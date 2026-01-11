import { getTokenSecurityConfig } from './tokenSecurityConfig.svelte.js'
import { namespacedKey } from '../config/appKey.js'
import { TokenCipher } from '../security/tokenCipher.svelte.js'
import { createLogger } from '../../lib/logger.js'

const logger = createLogger('core/auth/token-manager')

function getRefreshTokenPersistence() {
  const override = import.meta.env.VITE_AUTH_REFRESH_TOKEN_PERSISTENCE
  if (override && ['local', 'session', 'memory'].includes(override.toLowerCase())) {
    return override.toLowerCase()
  }
  
  return 'local'
}

function selectStorage(persistence) {
  if (typeof window === 'undefined') {
    return null
  }

  try {
    if (persistence === 'local') {
      return window.localStorage
    }
    if (persistence === 'session') {
      return window.sessionStorage
    }
  } catch (error) {
    logger.warn('Storage unavailable, falling back to in-memory tokens', error)
  }

  return null
}

function sanitizeToken(token) {
  if (!token || typeof token !== 'string') {
    return null
  }
  if (token.length <= 8) {
    return token
  }
  return `${token.slice(0, 4)}...${token.slice(-4)}`
}


function extractAudience(token) {
  if (!token || typeof token !== 'string') {
    return null
  }
  
  try {
    const parts = token.split('.')
    if (parts.length !== 3) {
      return null
    }
    
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')))
    return payload.aud || null
  } catch (error) {
    logger.warn('Failed to extract audience from token', error)
    return null
  }
}

export class TokenManager {
  constructor() {
    
    this.accessToken = null
    this.tokenExpiry = null
    
    
    this.tokens = new Map() 
    
    this.refreshToken = null
    this.userInfo = null
    this.refreshTimer = null
    this.autoRefreshHandler = null
    this.sessionExpiredHandler = null
    this.isReady = false
    this.refreshAttempts = 0
    this.maxRefreshRetries = 3
    this.storageKey = null
    this.refreshTokenKey = null

    const securityConfig = getTokenSecurityConfig()
    this.persistence = securityConfig.persistence
    this.refreshTokenPersistence = getRefreshTokenPersistence()
    this.auditAccess = securityConfig.auditAccess
    this.storage = selectStorage(securityConfig.persistence)
    this.refreshTokenStorage = selectStorage(this.refreshTokenPersistence)
    this.cipher = new TokenCipher(securityConfig.encryptionKey)

    this.ready = this.initialize()
  }

  async initialize() {
    this.storageKey = namespacedKey('auth-tokens')
    this.refreshTokenKey = namespacedKey('refresh-token')
    await this.loadFromStorage()
    this.setupAutoRefresh()
    this.isReady = true
  }

  async loadFromStorage() {
    if (!this.storage) {
      return
    }

    try {
      const stored = this.storage.getItem(this.storageKey)
      if (!stored) {
        return
      }

      const decrypted = await this.cipher.decrypt(stored)
      if (!decrypted) {
        await this.clearStorage()
        return
      }

      const data = JSON.parse(decrypted)
      
      
      if (data.tokens && typeof data.tokens === 'object') {
        for (const [audience, tokenData] of Object.entries(data.tokens)) {
          if (tokenData.expiry && new Date(tokenData.expiry) > new Date()) {
            this.tokens.set(audience, {
              accessToken: tokenData.accessToken,
              expiry: new Date(tokenData.expiry),
              scopes: tokenData.scopes || []
            })
          }
        }
        
        
        const firstToken = this.tokens.values().next().value
        if (firstToken) {
          this.accessToken = firstToken.accessToken
          this.tokenExpiry = firstToken.expiry
        }
      }
      
      else if (data.expiry && new Date(data.expiry) > new Date()) {
        this.accessToken = data.accessToken
        this.tokenExpiry = new Date(data.expiry)
        
        
        const aud = extractAudience(data.accessToken)
        if (aud) {
          this.tokens.set(aud, {
            accessToken: data.accessToken,
            expiry: this.tokenExpiry,
            scopes: []
          })
        }
      }
      
      this.userInfo = data.userInfo || null

      if (this.auditAccess && this.tokenExpiry) {
        logger.debug('Tokens restored from storage', {
          persistence: this.persistence,
          tokenCount: this.tokens.size,
          expiry: this.tokenExpiry.toISOString()
        })
      }
      
      
      if (data.refreshToken) {
        this.refreshToken = data.refreshToken
      } else if (this.refreshTokenStorage) {
        
        const refreshStored = this.refreshTokenStorage.getItem(this.refreshTokenKey)
        if (refreshStored) {
          const refreshDecrypted = await this.cipher.decrypt(refreshStored)
          if (refreshDecrypted) {
            this.refreshToken = refreshDecrypted
            logger.debug('Refresh token restored from separate storage')
          }
        }
      }

      if (this.auditAccess && this.refreshToken) {
        logger.debug('Refresh token available', {
          storage: this.refreshTokenPersistence
        })
      }
    } catch (error) {
      logger.warn('Failed to load stored tokens, clearing cache', error)
      await this.clearStorage()
    }
  }

  async saveToStorage() {
    if (!this.storage) {
      return
    }

    if (this.tokens.size === 0 || !this.accessToken || !this.tokenExpiry) {
      await this.clearStorage()
      return
    }

    
    const tokensObj = {}
    for (const [audience, tokenData] of this.tokens) {
      tokensObj[audience] = {
        accessToken: tokenData.accessToken,
        expiry: tokenData.expiry.toISOString(),
        scopes: tokenData.scopes
      }
    }

    const data = {
      tokens: tokensObj,  
      
      accessToken: this.accessToken,
      expiry: this.tokenExpiry.toISOString(),
      refreshToken: this.refreshToken,
      userInfo: this.userInfo
    }

    try {
      const payload = JSON.stringify(data)
      const encrypted = await this.cipher.encrypt(payload)
      this.storage.setItem(this.storageKey, encrypted)

      
      if (this.refreshToken && this.refreshTokenStorage && this.refreshTokenStorage !== this.storage) {
        const refreshEncrypted = await this.cipher.encrypt(this.refreshToken)
        this.refreshTokenStorage.setItem(this.refreshTokenKey, refreshEncrypted)
        
        if (this.auditAccess) {
          logger.debug('Refresh token persisted separately', {
            storage: this.refreshTokenPersistence
          })
        }
      }
    } catch (error) {
      logger.warn('Failed to persist tokens', error)
    }
  }

  async clearStorage() {
    if (this.storage) {
      try {
        this.storage.removeItem(this.storageKey)
      } catch (error) {
        logger.warn('Failed to clear stored tokens', error)
      }
    }

    
    if (this.refreshTokenStorage) {
      try {
        this.refreshTokenStorage.removeItem(this.refreshTokenKey)
      } catch (error) {
        logger.warn('Failed to clear refresh token', error)
      }
    }

    this.accessToken = null
    this.refreshToken = null
    this.tokenExpiry = null
    this.userInfo = null
    this.tokens.clear() 
  }

  
  async setTokens(tokensData, refreshToken = null, userInfo = null) {
    await this.ready

    
    if (tokensData.accessToken && tokensData.expiresIn) {
      return this.setTokensLegacy(tokensData.accessToken, refreshToken || tokensData.refreshToken, tokensData.expiresIn, userInfo)
    }

    
    if (!Array.isArray(tokensData) || tokensData.length === 0) {
      await this.clear()
      return
    }

    this.tokens.clear()
    let firstToken = null

    for (const tokenInfo of tokensData) {
      const { accessToken, audience, scopes = [], expiresIn } = tokenInfo
      
      if (!accessToken || !expiresIn) {
        logger.warn('Invalid token data, skipping', { hasToken: !!accessToken, hasExpiry: !!expiresIn })
        continue
      }

      
      const aud = audience || extractAudience(accessToken)
      if (!aud) {
        logger.warn('Cannot determine audience for token, skipping')
        continue
      }

      const expiry = new Date(Date.now() + expiresIn * 1000)
      this.tokens.set(aud, {
        accessToken,
        expiry,
        scopes
      })

      
      if (!firstToken) {
        firstToken = { accessToken, expiry }
      }

      logger.debug('Token registered', {
        audience: aud,
        scopes,
        expiresAt: expiry.toISOString()
      })
    }

    
    if (firstToken) {
      this.accessToken = firstToken.accessToken
      this.tokenExpiry = firstToken.expiry
    }

    this.refreshToken = refreshToken || null
    this.userInfo = userInfo || null
    this.refreshAttempts = 0

    if (this.auditAccess) {
      logger.debug('Multi-tokens updated', {
        tokenCount: this.tokens.size,
        audiences: Array.from(this.tokens.keys()),
        hasRefreshToken: Boolean(this.refreshToken)
      })
    }

    await this.saveToStorage()
    this.setupAutoRefresh()
  }

  
  async setTokensLegacy(accessToken, refreshToken, expiresIn, userInfo = null) {
    await this.ready

    if (!accessToken || !expiresIn) {
      await this.clear()
      return
    }

    this.accessToken = accessToken
    this.refreshToken = refreshToken || null
    this.tokenExpiry = new Date(Date.now() + expiresIn * 1000)
    this.userInfo = userInfo || null
    this.refreshAttempts = 0

    
    const aud = extractAudience(accessToken)
    if (aud) {
      const previousScopes = this.tokens.get(aud)?.scopes
      this.tokens.set(aud, {
        accessToken,
        expiry: this.tokenExpiry,
        scopes: Array.isArray(previousScopes) && previousScopes.length > 0 ? previousScopes : []
      })
    }

    if (this.auditAccess) {
      logger.debug('Tokens updated (legacy format)', {
        accessToken: sanitizeToken(this.accessToken),
        hasRefreshToken: Boolean(this.refreshToken),
        expiresAt: this.tokenExpiry.toISOString(),
        audience: aud || 'unknown'
      })
    }

    await this.saveToStorage()
    this.setupAutoRefresh()
  }

  
  getAccessToken(audienceOrScopes = null) {
    if (!this.isReady) {
      return null
    }

    
    if (!audienceOrScopes) {
      if (!this.accessToken || !this.tokenExpiry || new Date() >= this.tokenExpiry) {
        return null
      }

      if (this.auditAccess) {
        logger.debug('Access token read (default)', {
          accessToken: sanitizeToken(this.accessToken),
          expiresAt: this.tokenExpiry.toISOString()
        })
      }
      
      logger.debug('getAccessToken() default token', sanitizeToken(this.accessToken))

      return this.accessToken
    }

    
    if (typeof audienceOrScopes === 'string') {
      
      if (this.tokens.has(audienceOrScopes)) {
        const tokenData = this.tokens.get(audienceOrScopes)
        if (new Date() >= tokenData.expiry) {
          return null
        }

        if (this.auditAccess) {
          logger.debug('Access token read (by audience)', {
            audience: audienceOrScopes,
            accessToken: sanitizeToken(tokenData.accessToken),
            expiresAt: tokenData.expiry.toISOString()
          })
        }
        
        logger.debug(`getAccessToken('${audienceOrScopes}') exact audience`, sanitizeToken(tokenData.accessToken))

        return tokenData.accessToken
      }

      
      for (const [aud, tokenData] of this.tokens) {
        if (aud.includes(audienceOrScopes)) {
          if (new Date() >= tokenData.expiry) {
            continue
          }

          if (this.auditAccess) {
            logger.debug('Access token read (by partial audience match)', {
              requested: audienceOrScopes,
              matched: aud,
              accessToken: sanitizeToken(tokenData.accessToken)
            })
          }
          
          logger.debug(`getAccessToken('${audienceOrScopes}') partial audience '${aud}'`, sanitizeToken(tokenData.accessToken))

          return tokenData.accessToken
        }
      }

      
      for (const [aud, tokenData] of this.tokens) {
        if (tokenData.scopes.includes(audienceOrScopes) || tokenData.scopes.some(s => s.includes(audienceOrScopes))) {
          if (new Date() >= tokenData.expiry) {
            continue
          }

          if (this.auditAccess) {
            logger.debug('Access token read (by scope)', {
              requestedScope: audienceOrScopes,
              audience: aud,
              accessToken: sanitizeToken(tokenData.accessToken)
            })
          }
          
          logger.debug(`getAccessToken('${audienceOrScopes}') scope match in '${aud}'`, sanitizeToken(tokenData.accessToken))

          return tokenData.accessToken
        }
      }

      
      const onlyScopeLessTokens = this.tokens.size > 0 && Array.from(this.tokens.values()).every(t => !t.scopes || t.scopes.length === 0)
      if (onlyScopeLessTokens && this.accessToken && this.tokenExpiry && new Date() < this.tokenExpiry) {
        logger.warn('No scoped token found, falling back to default access token', { requested: audienceOrScopes })
        return this.accessToken
      }

      logger.warn('No token found for audience or scope', { requested: audienceOrScopes })
      return null
    }

    
    if (Array.isArray(audienceOrScopes)) {
      for (const [aud, tokenData] of this.tokens) {
        
        const hasAllScopes = audienceOrScopes.every(requestedScope =>
          tokenData.scopes.some(tokenScope => 
            tokenScope === requestedScope || tokenScope.includes(requestedScope)
          )
        )

        if (hasAllScopes) {
          if (new Date() >= tokenData.expiry) {
            continue
          }

          if (this.auditAccess) {
            logger.debug('Access token read (by scopes list)', {
              requestedScopes: audienceOrScopes,
              audience: aud,
              accessToken: sanitizeToken(tokenData.accessToken)
            })
          }
          
          logger.debug(`getAccessToken([${audienceOrScopes.join(', ')}]) all scopes match in '${aud}'`, sanitizeToken(tokenData.accessToken))

          return tokenData.accessToken
        }
      }

      logger.warn('No token found with all requested scopes', { requested: audienceOrScopes })
      return null
    }

    logger.warn('Invalid parameter type for getAccessToken', { type: typeof audienceOrScopes })
    return null
  }

  getRefreshToken() {
    if (!this.isReady) {
      return null
    }
    return this.refreshToken
  }

  isTokenValid() {
    return Boolean(
      this.accessToken &&
      this.tokenExpiry &&
      new Date() < this.tokenExpiry
    )
  }

  setAutoRefreshHandler(handler) {
    this.autoRefreshHandler = handler
    this.setupAutoRefresh()
  }

  
  setSessionExpiredHandler(handler) {
    this.sessionExpiredHandler = handler
  }

  
  async handleExpiredSession() {
    logger.warn('Session expired after max refresh retries')
    
    
    await this.clear()

    
    if (this.sessionExpiredHandler) {
      try {
        await this.sessionExpiredHandler()
      } catch (error) {
        logger.error('Session expired handler failed', error)
      }
    }
  }

  
  async attemptRefreshWithRetry(attempt = 1) {
    if (!this.autoRefreshHandler) {
      logger.warn('Auto-refresh handler not set, skipping refresh')
      return false
    }

    if (attempt > this.maxRefreshRetries) {
      logger.error('Max refresh retries reached', { attempts: attempt - 1 })
      await this.handleExpiredSession()
      return false
    }

    logger.debug(`Refresh attempt ${attempt}/${this.maxRefreshRetries}`)

    try {
      const result = await this.autoRefreshHandler()
      
      if (result && result.success) {
        this.refreshAttempts = 0 
        logger.debug('Token refresh successful', { attempt })
        
        return true
      } else {
        logger.warn(`Refresh attempt ${attempt} failed`, { error: result?.error })
      }
    } catch (error) {
      logger.warn(`Refresh attempt ${attempt} threw error`, error)
    }

    
    this.refreshAttempts = attempt
    const backoffMs = Math.pow(2, attempt) * 1000 
    logger.debug(`Scheduling retry in ${backoffMs}ms`, { nextAttempt: attempt + 1 })

    setTimeout(() => {
      this.attemptRefreshWithRetry(attempt + 1)
    }, backoffMs)

    return false
  }

  setupAutoRefresh() {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer)
      this.refreshTimer = null
    }

    if (!this.tokenExpiry) {
      return
    }

    const now = Date.now()
    const expiryTime = this.tokenExpiry.getTime()
    const timeUntilExpiry = expiryTime - now

    const overrideIntervalSeconds = Number(import.meta.env.VITE_AUTH_FORCE_REFRESH_INTERVAL_SECONDS)
    const overrideIntervalMs = Number.isFinite(overrideIntervalSeconds) && overrideIntervalSeconds > 0
      ? overrideIntervalSeconds * 1000
      : null

    
    if (!this.refreshToken) {
      const expireSession = () => {
        this.handleExpiredSession().catch(error => {
          logger.error('Failed to handle expired session without refresh token', error)
        })
      }

      if (timeUntilExpiry <= 0) {
        logger.warn('Token expired and no refresh token available, expiring session now')
        expireSession()
      } else {
        logger.warn('No refresh token available; scheduling session expiration at access token expiry', {
          expiresInMs: timeUntilExpiry
        })
        this.refreshTimer = setTimeout(expireSession, timeUntilExpiry)
      }
      return
    }

    const refreshLeadTime = 5 * 60 * 1000 
    const defaultTimeUntilRefresh = Math.max(timeUntilExpiry - refreshLeadTime, 0)
    const timeUntilRefresh = overrideIntervalMs
      ? Math.min(overrideIntervalMs, Math.max(timeUntilExpiry, 0))
      : defaultTimeUntilRefresh

    if (timeUntilRefresh > 0) {
      
      logger.debug('Auto-refresh scheduled', {
        expiresAt: this.tokenExpiry.toLocaleString(),
        refreshIn: `${Math.floor(timeUntilRefresh / 1000)}s`,
        overrideIntervalSeconds: overrideIntervalMs ? Math.floor(overrideIntervalMs / 1000) : undefined
      })

      this.refreshTimer = setTimeout(() => {
        this.attemptRefreshWithRetry(1)
      }, timeUntilRefresh)
    } else if (timeUntilExpiry > 0) {
      
      logger.warn('Token expires soon, refreshing immediately', {
        expiresIn: `${Math.floor(timeUntilExpiry / 1000)}s`
      })

      this.attemptRefreshWithRetry(1)
    } else {
      
      logger.warn('Token already expired', {
        expiredAt: this.tokenExpiry.toISOString()
      })

      if (this.refreshToken && this.autoRefreshHandler) {
        
        logger.debug('Attempting refresh with expired token')
        this.attemptRefreshWithRetry(1)
      } else {
        
        this.handleExpiredSession()
      }
    }
  }

  async clear() {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer)
      this.refreshTimer = null
    }

    this.tokens.clear() 
    this.refreshAttempts = 0
    await this.clearStorage()
  }
}
