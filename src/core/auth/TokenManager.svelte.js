import { authDebug, authError, authWarn } from '@/core/auth/authLogging.svelte.js'
import { getTokenSecurityConfig } from '@/core/auth/tokenSecurityConfig.svelte.js'
import { namespacedKey } from '@/core/config/appKey.js'
import { TokenCipher } from '@/core/security/tokenCipher.svelte.js'

const STORAGE_KEY = namespacedKey('auth-tokens')

// Configuration pour le refresh token (peut être overridée par VITE_AUTH_REFRESH_TOKEN_PERSISTENCE)
function getRefreshTokenPersistence() {
  const override = import.meta.env.VITE_AUTH_REFRESH_TOKEN_PERSISTENCE
  if (override && ['local', 'session', 'memory'].includes(override.toLowerCase())) {
    return override.toLowerCase()
  }
  // Par défaut : localStorage pour survivre à la fermeture du navigateur
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
    authWarn('Storage unavailable, falling back to in-memory tokens', error)
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
  return `${token.slice(0, 4)}…${token.slice(-4)}`
}

export class TokenManager {
  constructor() {
    this.accessToken = null
    this.refreshToken = null
    this.tokenExpiry = null
    this.userInfo = null
    this.refreshTimer = null
    this.autoRefreshHandler = null
    this.sessionExpiredHandler = null
    this.isReady = false
    this.refreshAttempts = 0
    this.maxRefreshRetries = 3

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
    await this.loadFromStorage()
    this.setupAutoRefresh()
    this.isReady = true
  }

  async loadFromStorage() {
    if (!this.storage) {
      return
    }

    try {
      const stored = this.storage.getItem(STORAGE_KEY)
      if (!stored) {
        return
      }

      const decrypted = await this.cipher.decrypt(stored)
      if (!decrypted) {
        await this.clearStorage()
        return
      }

      const data = JSON.parse(decrypted)
      
      // Restaurer access token si valide
      if (data.expiry && new Date(data.expiry) > new Date()) {
        this.accessToken = data.accessToken
        this.tokenExpiry = new Date(data.expiry)
        this.userInfo = data.userInfo || null

        if (this.auditAccess) {
          authDebug('Tokens restored from storage', {
            persistence: this.persistence,
            expiry: this.tokenExpiry.toISOString()
          })
        }
      } else if (data.userInfo) {
        // Access token expiré mais on garde userInfo pour tenter un refresh
        this.userInfo = data.userInfo
        authDebug('Access token expired, userInfo retained for potential refresh')
      }

      // Restaurer refresh token (peut être dans un storage différent)
      if (data.refreshToken) {
        this.refreshToken = data.refreshToken
      } else if (this.refreshTokenStorage) {
        // Vérifier si refresh token stocké séparément
        const refreshStored = this.refreshTokenStorage.getItem(namespacedKey('refresh-token'))
        if (refreshStored) {
          const refreshDecrypted = await this.cipher.decrypt(refreshStored)
          if (refreshDecrypted) {
            this.refreshToken = refreshDecrypted
            authDebug('Refresh token restored from separate storage')
          }
        }
      }

      if (this.auditAccess && this.refreshToken) {
        authDebug('Refresh token available', {
          storage: this.refreshTokenPersistence
        })
      }
    } catch (error) {
      authWarn('Failed to load stored tokens, clearing cache', error)
      await this.clearStorage()
    }
  }

  async saveToStorage() {
    if (!this.storage) {
      return
    }

    if (!this.accessToken || !this.tokenExpiry) {
      await this.clearStorage()
      return
    }

    const data = {
      accessToken: this.accessToken,
      refreshToken: this.refreshToken,
      expiry: this.tokenExpiry.toISOString(),
      userInfo: this.userInfo
    }

    try {
      const payload = JSON.stringify(data)
      const encrypted = await this.cipher.encrypt(payload)
      this.storage.setItem(STORAGE_KEY, encrypted)

      // Sauvegarder refresh token séparément si stockage différent
      if (this.refreshToken && this.refreshTokenStorage && this.refreshTokenStorage !== this.storage) {
        const refreshEncrypted = await this.cipher.encrypt(this.refreshToken)
        this.refreshTokenStorage.setItem(namespacedKey('refresh-token'), refreshEncrypted)
        
        if (this.auditAccess) {
          authDebug('Refresh token persisted separately', {
            storage: this.refreshTokenPersistence
          })
        }
      }
    } catch (error) {
      authWarn('Failed to persist tokens', error)
    }
  }

  async clearStorage() {
    if (this.storage) {
      try {
        this.storage.removeItem(STORAGE_KEY)
      } catch (error) {
        authWarn('Failed to clear stored tokens', error)
      }
    }

    // Effacer aussi le refresh token séparé si existe
    if (this.refreshTokenStorage) {
      try {
        this.refreshTokenStorage.removeItem(namespacedKey('refresh-token'))
      } catch (error) {
        authWarn('Failed to clear refresh token', error)
      }
    }

    this.accessToken = null
    this.refreshToken = null
    this.tokenExpiry = null
    this.userInfo = null
  }

  async setTokens(accessToken, refreshToken, expiresIn, userInfo = null) {
    await this.ready

    if (!accessToken || !expiresIn) {
      await this.clear()
      return
    }

    this.accessToken = accessToken
    this.refreshToken = refreshToken || null
    this.tokenExpiry = new Date(Date.now() + expiresIn * 1000)
    this.userInfo = userInfo || null
    this.refreshAttempts = 0 // Reset compteur de tentatives sur nouveau token

    if (this.auditAccess) {
      authDebug('Tokens updated', {
        accessToken: sanitizeToken(this.accessToken),
        hasRefreshToken: Boolean(this.refreshToken),
        expiresAt: this.tokenExpiry.toISOString(),
        refreshStorage: this.refreshTokenPersistence
      })
    }

    await this.saveToStorage()
    this.setupAutoRefresh()
  }

  getAccessToken() {
    if (!this.isReady || !this.accessToken || !this.tokenExpiry) {
      return null
    }

    if (new Date() >= this.tokenExpiry) {
      return null
    }

    if (this.auditAccess) {
      authDebug('Access token read', {
        accessToken: sanitizeToken(this.accessToken),
        expiresAt: this.tokenExpiry.toISOString()
      })
    }

    return this.accessToken
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

  /**
   * Définit le handler appelé quand la session expire définitivement
   * @param {Function} handler - Fonction async à appeler
   */
  setSessionExpiredHandler(handler) {
    this.sessionExpiredHandler = handler
  }

  /**
   * Appelée quand tous les essais de refresh ont échoué
   * @private
   */
  async handleExpiredSession() {
    authWarn('Session expired after max refresh retries')
    
    // Nettoyer les tokens
    await this.clear()

    // Notifier le handler si défini
    if (this.sessionExpiredHandler) {
      try {
        await this.sessionExpiredHandler()
      } catch (error) {
        authError('Session expired handler failed', error)
      }
    }
  }

  /**
   * Tente de refresh le token avec retry et backoff exponentiel
   * @param {number} attempt - Numéro de tentative (1-indexed)
   * @returns {Promise<boolean>} true si succès
   * @private
   */
  async attemptRefreshWithRetry(attempt = 1) {
    if (!this.autoRefreshHandler) {
      authWarn('Auto-refresh handler not set, skipping refresh')
      return false
    }

    if (attempt > this.maxRefreshRetries) {
      authError('Max refresh retries reached', { attempts: attempt - 1 })
      await this.handleExpiredSession()
      return false
    }

    authDebug(`Refresh attempt ${attempt}/${this.maxRefreshRetries}`)

    try {
      const result = await this.autoRefreshHandler()
      
      if (result && result.success) {
        this.refreshAttempts = 0 // Reset sur succès
        authDebug('Token refresh successful', { attempt })
        // Le handler aura appelé setTokens() qui va re-scheduler setupAutoRefresh()
        return true
      } else {
        authWarn(`Refresh attempt ${attempt} failed`, { error: result?.error })
      }
    } catch (error) {
      authWarn(`Refresh attempt ${attempt} threw error`, error)
    }

    // Échec → retry avec backoff
    this.refreshAttempts = attempt
    const backoffMs = Math.pow(2, attempt) * 1000 // 2s, 4s, 8s
    authDebug(`Scheduling retry in ${backoffMs}ms`, { nextAttempt: attempt + 1 })

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

    if (!this.tokenExpiry || !this.refreshToken) {
      return
    }

    const now = Date.now()
    const expiryTime = this.tokenExpiry.getTime()
    const timeUntilExpiry = expiryTime - now
    const refreshLeadTime = 5 * 60 * 1000 // 5 minutes avant expiration
    const timeUntilRefresh = timeUntilExpiry - refreshLeadTime

    if (timeUntilRefresh > 0) {
      // Cas normal : schedule refresh 5 min avant expiration
      authDebug('Auto-refresh scheduled', {
        expiresAt: this.tokenExpiry.toISOString(),
        refreshIn: `${Math.floor(timeUntilRefresh / 1000)}s`
      })

      this.refreshTimer = setTimeout(() => {
        this.attemptRefreshWithRetry(1)
      }, timeUntilRefresh)
    } else if (timeUntilExpiry > 0) {
      // Token valide mais moins de 5 min restantes → refresh immédiat
      authWarn('Token expires soon, refreshing immediately', {
        expiresIn: `${Math.floor(timeUntilExpiry / 1000)}s`
      })

      this.attemptRefreshWithRetry(1)
    } else {
      // Token déjà expiré
      authWarn('Token already expired', {
        expiredAt: this.tokenExpiry.toISOString()
      })

      if (this.refreshToken && this.autoRefreshHandler) {
        // Tenter quand même un refresh
        authDebug('Attempting refresh with expired token')
        this.attemptRefreshWithRetry(1)
      } else {
        // Pas de refresh possible → session expirée
        this.handleExpiredSession()
      }
    }
  }

  async clear() {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer)
      this.refreshTimer = null
    }

    this.refreshAttempts = 0
    await this.clearStorage()
  }
}
