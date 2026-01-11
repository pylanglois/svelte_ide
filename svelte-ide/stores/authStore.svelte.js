import { createLogger } from '../lib/logger.js'
import { AuthManager } from '../core/auth/AuthManager.svelte.js'
import { providerRegistry } from '../core/auth/providers/index.js'

const logger = createLogger('core/auth/auth-store')

function initializeAuthProviders(authManager) {
  const rawProviders = import.meta.env.VITE_AUTH_PROVIDERS || ''
  const enabledProviders = rawProviders
    .split(',')
    .map(providerId => providerId.trim())
    .filter(Boolean)
  if (enabledProviders.length === 0) {
    throw new Error('AuthStore: VITE_AUTH_PROVIDERS is required')
  }

  const providerIds = Array.from(new Set(enabledProviders))
  const registryProviderIds = new Set(Object.keys(providerRegistry))
  const unsupportedProviders = providerIds.filter(id => !registryProviderIds.has(id))
  if (unsupportedProviders.length > 0) {
    throw new Error(`AuthStore: Unsupported providers: ${unsupportedProviders.join(', ')}`)
  }

  logger.debug('Enabled auth providers', { enabledProviders: providerIds })

  let hasProviders = false

  for (const providerId of providerIds) {
    const ProviderClass = providerRegistry[providerId]
    if (!ProviderClass) {
      throw new Error(`AuthStore: Provider ${providerId} is not registered`)
    }
    if (typeof ProviderClass.fromEnv !== 'function') {
      throw new Error(`AuthStore: Provider ${providerId} does not support env configuration`)
    }

    const provider = ProviderClass.fromEnv(import.meta.env)
    if (!provider || !provider.id) {
      throw new Error(`AuthStore: Provider ${providerId} failed to initialize`)
    }

    authManager.registerProvider(provider)
    hasProviders = true
    logger.debug('Provider registered', { providerId })
  }

  if (!hasProviders) {
    throw new Error('AuthStore: No authentication provider configured')
  }
}

function createAuthStore() {
  const authManager = new AuthManager()
  
  let isAuthenticated = $state(authManager.isAuthenticated)
  let currentUser = $state(authManager.currentUser)
  let isLoading = $state(false)
  let error = $state(null)
  let availableProviders = $state([])
  let initialized = $state(false)
  let initializing = $state(false)
  let initializationFailed = $state(false)
  let encryptionKey = $state(null)
  let sessionStatus = $state({ type: null, message: null })

  
  const hasEncryptionKey = $derived(encryptionKey !== null && encryptionKey.length > 0)

  function setSessionStatus(type = null, message = null) {
    if (!type) {
      sessionStatus = { type: null, message: null }
      return
    }
    sessionStatus = { type, message }
  }

  function syncFromManager(forceProviders = false) {
    isAuthenticated = authManager.isAuthenticated
    currentUser = authManager.currentUser
    if (isAuthenticated) {
      setSessionStatus()
    }
    if (forceProviders || initialized) {
      availableProviders = authManager.getAvailableProviders()
    }
  }

  const store = {
    get isAuthenticated() { return isAuthenticated },
    get currentUser() { return currentUser },
    get isLoading() { return isLoading },
    get error() { return error },
    get availableProviders() { return availableProviders },
    get initialized() { return initialized },
    get encryptionKey() { return encryptionKey },
    get hasEncryptionKey() { return hasEncryptionKey },
    get sessionStatus() { return sessionStatus },

    setEncryptionKey(key) {
      if (!key || typeof key !== 'string') {
        logger.warn('Attempted to set invalid encryption key', { type: typeof key })
        return
      }
      encryptionKey = key
      logger.debug('Encryption key set', { keyLength: key.length })
    },

    clearEncryptionKey() {
      if (encryptionKey) {
        logger.debug('Clearing encryption key')
        encryptionKey = null
      }
    },

    clearSessionStatus() {
      setSessionStatus()
    },

    handleSessionExpired(payload = {}) {
      this.clearEncryptionKey()
      setSessionStatus('expired', payload?.message || 'Session expired. Please sign in again.')
      isAuthenticated = false
      currentUser = null
      error = null
      syncFromManager(true)
    },

    async initialize() {
      if (initialized || initializing || initializationFailed) {
        return
      }

      try {
        initializing = true
        isLoading = true
        error = null
        
        initializeAuthProviders(authManager)
        await authManager.ready
        if (authManager.initError) {
          throw authManager.initError
        }
        await authManager.initializeProviders()

        if (authManager.getAvailableProviders().length === 0) {
          throw new Error('AuthStore: No available providers after initialization')
        }
        
        
        const currentPath = window.location.pathname
        if (currentPath.startsWith('/auth/') && currentPath.includes('/callback') || window.location.search.includes('code=')) {
          logger.debug('Detected OAuth callback, delegating to AuthManager')
          const result = await authManager.handleCallback()
          
          if (result.success) {
            syncFromManager()
          } else if (result.error) {
            error = result.error
          }
        }

        if (authManager.isAuthenticated && authManager.currentUser) {
          syncFromManager()
        }

        initialized = true
        syncFromManager(true)
      } catch (err) {
        logger.error('AuthStore initialization error', err)
        error = err.message || 'Unknown authentication error'
        initializationFailed = true
      } finally {
        isLoading = false
        initializing = false
      }
    },

    async login(providerId) {
      try {
        isLoading = true
        error = null
        
        logger.debug('Starting login', { providerId })
        const result = await authManager.login(providerId)
        
        if (result.redirected) {
          
          logger.debug('Redirected to provider OAuth', { providerId })
          return result
        }
        
        if (result.success) {
          syncFromManager()
          logger.debug('Login successful', { providerId })
          this.clearSessionStatus()
        } else {
          error = result.error
        }
        
        return result
      } catch (err) {
        logger.error('AuthStore login error', err)
        error = err.message
        return { success: false, error: err.message }
      } finally {
        isLoading = false
      }
    },

    async logout() {
      try {
        isLoading = true
        error = null
        
        logger.debug('Starting logout')
        const result = await authManager.logout()
        
        syncFromManager()
        
        logger.debug('Logout completed')
        return result
      } catch (err) {
        logger.error('AuthStore logout error', err)
        error = err.message
        return { success: false, error: err.message }
      } finally {
        isLoading = false
      }
    },

    getAccessToken(audienceOrScopes) {
      return authManager.getAccessToken(audienceOrScopes)
    },

    async refreshToken() {
      try {
        logger.debug('Manual token refresh requested')
        const result = await authManager.refreshToken()
        
        if (!result.success) {
          error = result.error
          syncFromManager()
        }
        
        return result
      } catch (err) {
        logger.error('AuthStore token refresh error', err)
        error = err.message
        return { success: false, error: err.message }
      }
    },

    registerProvider(provider) {
      authManager.registerProvider(provider)
      if (initialized) {
        syncFromManager(true)
      }
    },

    clearError() {
      error = null
      initializationFailed = false
    }
  }

  
  authManager.setAuthStoreRef(store)

  return store
}

let _authStore = null

export function getAuthStore() {
  if (!_authStore) {
    _authStore = createAuthStore()
  }
  return _authStore
}
