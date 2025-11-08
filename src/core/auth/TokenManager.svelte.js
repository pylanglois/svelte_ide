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

/**
 * Décode un JWT pour extraire son audience (sans validation de signature)
 * @param {string} token - Le JWT
 * @returns {string|null} L'audience (aud claim) ou null
 */
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
    authWarn('Failed to extract audience from token', error)
    return null
  }
}

export class TokenManager {
  constructor() {
    // LEGACY : Compatibilité descendante (premier token ou défaut)
    this.accessToken = null
    this.tokenExpiry = null
    
    // NOUVEAU : Multi-tokens par audience
    this.tokens = new Map() // audience → { accessToken, expiry, scopes }
    
    this.refreshToken = null
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
      
      // NOUVEAU : Restaurer multi-tokens si présents
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
        
        // Maintenir compatibilité : premier token devient le token par défaut
        const firstToken = this.tokens.values().next().value
        if (firstToken) {
          this.accessToken = firstToken.accessToken
          this.tokenExpiry = firstToken.expiry
        }
      }
      // LEGACY : Format ancien (single token)
      else if (data.expiry && new Date(data.expiry) > new Date()) {
        this.accessToken = data.accessToken
        this.tokenExpiry = new Date(data.expiry)
        
        // Tenter d'extraire l'audience pour migration
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
        authDebug('Tokens restored from storage', {
          persistence: this.persistence,
          tokenCount: this.tokens.size,
          expiry: this.tokenExpiry.toISOString()
        })
      }
      
      // 🔍 LOGGING : Afficher les tokens restaurés en DEV
      if (import.meta.env.DEV && this.tokens.size > 0) {
        console.group('🔄 Multi-Tokens Restaurés du Storage')
        console.log('Nombre de tokens:', this.tokens.size)
        console.table(
          Array.from(this.tokens.entries()).map(([audience, tokenData]) => ({
            Audience: audience,
            'Token (tronqué)': tokenData.accessToken.substring(0, 30) + '...',
            Scopes: tokenData.scopes.join(', '),
            'Expire le': tokenData.expiry.toLocaleString('fr-CA'),
            'Est valide': new Date() < tokenData.expiry ? '✅' : '❌'
          }))
        )
        console.groupEnd()
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

    if (this.tokens.size === 0 || !this.accessToken || !this.tokenExpiry) {
      await this.clearStorage()
      return
    }

    // Sérialiser les multi-tokens
    const tokensObj = {}
    for (const [audience, tokenData] of this.tokens) {
      tokensObj[audience] = {
        accessToken: tokenData.accessToken,
        expiry: tokenData.expiry.toISOString(),
        scopes: tokenData.scopes
      }
    }

    const data = {
      tokens: tokensObj,  // NOUVEAU format
      // LEGACY : compatibilité descendante
      accessToken: this.accessToken,
      expiry: this.tokenExpiry.toISOString(),
      refreshToken: this.refreshToken,
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
    this.tokens.clear() // Nettoyer multi-tokens
  }

  /**
   * NOUVEAU : Enregistrer plusieurs tokens (un par audience)
   * @param {Array|Object} tokensData - Soit un tableau [{accessToken, audience, scopes, expiresIn}], soit un objet unique
   * @param {string} refreshToken - Refresh token (optionnel)
   * @param {Object} userInfo - Infos utilisateur (optionnel)
   */
  async setTokens(tokensData, refreshToken = null, userInfo = null) {
    await this.ready

    // Format legacy : {accessToken, refreshToken, expiresIn}
    if (tokensData.accessToken && tokensData.expiresIn) {
      return this.setTokensLegacy(tokensData.accessToken, refreshToken || tokensData.refreshToken, tokensData.expiresIn, userInfo)
    }

    // Nouveau format : array de tokens
    if (!Array.isArray(tokensData) || tokensData.length === 0) {
      await this.clear()
      return
    }

    this.tokens.clear()
    let firstToken = null

    for (const tokenInfo of tokensData) {
      const { accessToken, audience, scopes = [], expiresIn } = tokenInfo
      
      if (!accessToken || !expiresIn) {
        authWarn('Invalid token data, skipping', { hasToken: !!accessToken, hasExpiry: !!expiresIn })
        continue
      }

      // Extraire l'audience si non fournie
      const aud = audience || extractAudience(accessToken)
      if (!aud) {
        authWarn('Cannot determine audience for token, skipping')
        continue
      }

      const expiry = new Date(Date.now() + expiresIn * 1000)
      this.tokens.set(aud, {
        accessToken,
        expiry,
        scopes
      })

      // Le premier token devient le token par défaut (compatibilité)
      if (!firstToken) {
        firstToken = { accessToken, expiry }
      }

      authDebug('Token registered', {
        audience: aud,
        scopes,
        expiresAt: expiry.toISOString()
      })
    }

    // Maintenir compatibilité : premier token = default
    if (firstToken) {
      this.accessToken = firstToken.accessToken
      this.tokenExpiry = firstToken.expiry
    }

    this.refreshToken = refreshToken || null
    this.userInfo = userInfo || null
    this.refreshAttempts = 0

    if (this.auditAccess) {
      authDebug('Multi-tokens updated', {
        tokenCount: this.tokens.size,
        audiences: Array.from(this.tokens.keys()),
        hasRefreshToken: Boolean(this.refreshToken)
      })
    }

    await this.saveToStorage()
    this.setupAutoRefresh()
  }

  /**
   * LEGACY : Format ancien (single token)
   */
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

    // Tenter d'extraire l'audience pour migration vers multi-tokens
    const aud = extractAudience(accessToken)
    if (aud) {
      this.tokens.set(aud, {
        accessToken,
        expiry: this.tokenExpiry,
        scopes: []
      })
    }

    if (this.auditAccess) {
      authDebug('Tokens updated (legacy format)', {
        accessToken: sanitizeToken(this.accessToken),
        hasRefreshToken: Boolean(this.refreshToken),
        expiresAt: this.tokenExpiry.toISOString(),
        audience: aud || 'unknown'
      })
    }

    await this.saveToStorage()
    this.setupAutoRefresh()
  }

  /**
   * Récupère un access token
   * @param {string|Array<string>} [audienceOrScopes] - Audience cible ou liste de scopes
   * @returns {string|null} Le token correspondant ou null
   * 
   * Exemples:
   *   getAccessToken() // Token par défaut (premier ou Graph)
   *   getAccessToken('api://436fddc9-...') // Token pour cette audience
   *   getAccessToken(['User.Read', 'Mail.Read']) // Token ayant ces scopes
   *   getAccessToken('access_as_user') // Token ayant ce scope (recherche partielle)
   */
  getAccessToken(audienceOrScopes = null) {
    if (!this.isReady) {
      return null
    }

    // Cas 1 : Pas de paramètre → token par défaut (compatibilité)
    if (!audienceOrScopes) {
      if (!this.accessToken || !this.tokenExpiry || new Date() >= this.tokenExpiry) {
        return null
      }

      if (this.auditAccess) {
        authDebug('Access token read (default)', {
          accessToken: sanitizeToken(this.accessToken),
          expiresAt: this.tokenExpiry.toISOString()
        })
      }
      
      // 🔍 LOGGING DEV
      if (import.meta.env.DEV) {
        console.log('🎫 getAccessToken() → Token par défaut:', sanitizeToken(this.accessToken))
      }

      return this.accessToken
    }

    // Cas 2 : Audience exacte fournie
    if (typeof audienceOrScopes === 'string') {
      // Recherche exacte
      if (this.tokens.has(audienceOrScopes)) {
        const tokenData = this.tokens.get(audienceOrScopes)
        if (new Date() >= tokenData.expiry) {
          return null
        }

        if (this.auditAccess) {
          authDebug('Access token read (by audience)', {
            audience: audienceOrScopes,
            accessToken: sanitizeToken(tokenData.accessToken),
            expiresAt: tokenData.expiry.toISOString()
          })
        }
        
        // 🔍 LOGGING DEV
        if (import.meta.env.DEV) {
          console.log(`🎫 getAccessToken('${audienceOrScopes}') → Audience exacte:`, sanitizeToken(tokenData.accessToken))
        }

        return tokenData.accessToken
      }

      // Recherche partielle dans les audiences (ex: "access_as_user" match "api://xxx/access_as_user")
      for (const [aud, tokenData] of this.tokens) {
        if (aud.includes(audienceOrScopes)) {
          if (new Date() >= tokenData.expiry) {
            continue
          }

          if (this.auditAccess) {
            authDebug('Access token read (by partial audience match)', {
              requested: audienceOrScopes,
              matched: aud,
              accessToken: sanitizeToken(tokenData.accessToken)
            })
          }
          
          // 🔍 LOGGING DEV
          if (import.meta.env.DEV) {
            console.log(`🎫 getAccessToken('${audienceOrScopes}') → Match partiel audience '${aud}':`, sanitizeToken(tokenData.accessToken))
          }

          return tokenData.accessToken
        }
      }

      // Recherche dans les scopes
      for (const [aud, tokenData] of this.tokens) {
        if (tokenData.scopes.includes(audienceOrScopes) || tokenData.scopes.some(s => s.includes(audienceOrScopes))) {
          if (new Date() >= tokenData.expiry) {
            continue
          }

          if (this.auditAccess) {
            authDebug('Access token read (by scope)', {
              requestedScope: audienceOrScopes,
              audience: aud,
              accessToken: sanitizeToken(tokenData.accessToken)
            })
          }
          
          // 🔍 LOGGING DEV
          if (import.meta.env.DEV) {
            console.log(`🎫 getAccessToken('${audienceOrScopes}') → Match scope dans '${aud}':`, sanitizeToken(tokenData.accessToken))
          }

          return tokenData.accessToken
        }
      }

      authWarn('No token found for audience or scope', { requested: audienceOrScopes })
      return null
    }

    // Cas 3 : Liste de scopes fournie
    if (Array.isArray(audienceOrScopes)) {
      for (const [aud, tokenData] of this.tokens) {
        // Vérifier si le token a TOUS les scopes demandés
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
            authDebug('Access token read (by scopes list)', {
              requestedScopes: audienceOrScopes,
              audience: aud,
              accessToken: sanitizeToken(tokenData.accessToken)
            })
          }
          
          // 🔍 LOGGING DEV
          if (import.meta.env.DEV) {
            console.log(`🎫 getAccessToken([${audienceOrScopes.join(', ')}]) → Match tous scopes dans '${aud}':`, sanitizeToken(tokenData.accessToken))
          }

          return tokenData.accessToken
        }
      }

      authWarn('No token found with all requested scopes', { requested: audienceOrScopes })
      return null
    }

    authWarn('Invalid parameter type for getAccessToken', { type: typeof audienceOrScopes })
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

    this.tokens.clear() // Nettoyer multi-tokens
    this.refreshAttempts = 0
    await this.clearStorage()
  }
}
