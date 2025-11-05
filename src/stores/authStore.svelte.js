import { authDebug, authError, authWarn } from '@/core/auth/authLogging.svelte.js'
import { AuthManager } from '@/core/auth/AuthManager.svelte.js'
import { AzureProvider, GoogleProvider, MockProvider } from '@/core/auth/providers/index.js'

function getIdeStore() {
  return import('@/stores/ideStore.svelte.js').then(module => module.ideStore)
}

function initializeAuthProviders(authManager) {
  const rawProviders = import.meta.env.VITE_AUTH_PROVIDERS || ''
  const enabledProviders = rawProviders
    .split(',')
    .map(providerId => providerId.trim())
    .filter(Boolean)
  let hasRealProviders = false
  const isProd = import.meta.env.PROD
  const mockRequested = enabledProviders.includes('mock')
  const providersToProcess = enabledProviders.filter(id => id !== 'mock')

  if (isProd && enabledProviders.length === 0) {
    throw new Error('AuthStore: VITE_AUTH_PROVIDERS must be set in production builds')
  }

  if (isProd && mockRequested) {
    authWarn('MockProvider requested in production build; blocking usage', {
      enabledProviders,
      isProd
    })
    throw new Error('Provider not supported')
  }

  authDebug('Enabled auth providers', { enabledProviders })

  if (providersToProcess.includes('azure')) {
    const azureConfig = {
      clientId: import.meta.env.VITE_AZURE_CLIENT_ID,
      tenantId: import.meta.env.VITE_AZURE_TENANT_ID
    }
    
    authDebug('Azure config check', { 
      hasClientId: !!azureConfig.clientId, 
      hasTenantId: !!azureConfig.tenantId 
    })
    
    if (azureConfig.clientId && azureConfig.tenantId) {
      authManager.registerProvider(new AzureProvider(azureConfig))
      hasRealProviders = true
      authDebug('Azure provider registered')
    } else {
      authWarn('Azure provider skipped - missing configuration', azureConfig)
    }
  }

  if (providersToProcess.includes('google')) {
    const backendFlag = import.meta.env.VITE_GOOGLE_USE_BACKEND
    const allowSecretFlag = import.meta.env.VITE_GOOGLE_ALLOW_INSECURE_SECRET
    const googleConfig = {
      clientId: import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim(),
      backendTokenUrl: import.meta.env.VITE_GOOGLE_BACKEND_TOKEN_URL?.trim(),
      backendRefreshUrl: import.meta.env.VITE_GOOGLE_BACKEND_REFRESH_URL?.trim(),
      backendCredentials: import.meta.env.VITE_GOOGLE_BACKEND_CREDENTIALS,
      useBackendExchange: backendFlag === 'true' || backendFlag === '1',
      clientSecret: import.meta.env.VITE_GOOGLE_CLIENT_SECRET?.trim(),
      allowInsecureClientSecret: allowSecretFlag === 'true' || allowSecretFlag === '1'
    }
    
    authDebug('Google config check', { 
      hasClientId: !!googleConfig.clientId,
      hasBackendTokenUrl: !!googleConfig.backendTokenUrl,
      backendModeFlag: googleConfig.useBackendExchange,
      hasClientSecret: !!googleConfig.clientSecret,
      allowInsecureClientSecret: googleConfig.allowInsecureClientSecret
    })
    
    if (googleConfig.clientId) {
      const useBackend = googleConfig.useBackendExchange || !!googleConfig.backendTokenUrl || !!googleConfig.backendRefreshUrl
      if (useBackend && !googleConfig.backendTokenUrl) {
        authWarn('Google provider skipped - backend exchange enabled but backend token URL missing')
      } else {
        const providerConfig = {
          clientId: googleConfig.clientId
        }
        
        if (useBackend) {
          providerConfig.useBackendExchange = true
          if (googleConfig.backendTokenUrl) {
            providerConfig.backendTokenUrl = googleConfig.backendTokenUrl
          }
          if (googleConfig.backendRefreshUrl) {
            providerConfig.backendRefreshUrl = googleConfig.backendRefreshUrl
          }
          if (googleConfig.backendCredentials) {
            providerConfig.backendCredentials = googleConfig.backendCredentials
          }
        }
        
        if (!useBackend && googleConfig.clientSecret) {
          if (!googleConfig.allowInsecureClientSecret) {
            authWarn('Google clientSecret provided without allow flag; secret ignored')
          } else {
            providerConfig.clientSecret = googleConfig.clientSecret
            providerConfig.allowInsecureClientSecret = true
          }
        }
        
        authManager.registerProvider(new GoogleProvider(providerConfig))
        hasRealProviders = true
        authDebug('Google provider registered', { useBackend })
      }
    } else {
      authWarn('Google provider skipped - missing clientId')
    }
  }

  const allowMock = !isProd && (mockRequested || providersToProcess.length === 0)

  if (!hasRealProviders && !allowMock) {
    throw new Error('AuthStore: No authentication provider configured')
  }

  if (allowMock) {
    if (!hasRealProviders) {
      authWarn('No real providers configured, falling back to MockProvider (development only)')
    } else if (mockRequested) {
      authDebug('Registering MockProvider alongside real providers (development only)')
    }

    const mockConfig = {
      simulateDelay: import.meta.env.VITE_MOCK_AUTH_DELAY ? parseInt(import.meta.env.VITE_MOCK_AUTH_DELAY) : 1000,
      userInfo: {
        sub: 'mock-dev-user',
        name: 'Développeur Mock',
        email: 'dev@svelte-ide.local',
        picture: '👨‍💻'
      }
    }

    authManager.registerProvider(new MockProvider(mockConfig))
    authDebug('MockProvider registered', { fallback: !hasRealProviders })
    hasRealProviders = true
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

  // Dérivé : indique si une clé de chiffrement est disponible
  const hasEncryptionKey = $derived(encryptionKey !== null && encryptionKey.length > 0)

  function syncFromManager(forceProviders = false) {
    isAuthenticated = authManager.isAuthenticated
    currentUser = authManager.currentUser
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

    setEncryptionKey(key) {
      if (!key || typeof key !== 'string') {
        authWarn('Attempted to set invalid encryption key', { type: typeof key })
        return
      }
      encryptionKey = key
      authDebug('Encryption key set', { keyLength: key.length })
    },

    clearEncryptionKey() {
      if (encryptionKey) {
        authDebug('Clearing encryption key')
        encryptionKey = null
      }
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
        await authManager.initializeProviders()
        await authManager.ready
        
        // Vérifier si on est dans un callback OAuth
        const currentPath = window.location.pathname
        if (currentPath.startsWith('/auth/') && currentPath.includes('/callback') || window.location.search.includes('code=')) {
          authDebug('Detected OAuth callback, delegating to AuthManager')
          const result = await authManager.handleCallback()
          
          if (result.success) {
            syncFromManager()

            // Restaurer le layout utilisateur après une authentification réussie
            if (currentUser) {
              try {
                const ideStore = await getIdeStore()
                await ideStore.restoreUserLayout(currentUser)
              } catch (layoutError) {
                authWarn('Failed to restore user layout', layoutError)
              }
            }
          } else if (result.error) {
            error = result.error
          }
        }
        
        // Après l'initialisation, vérifier si l'utilisateur est déjà authentifié (reload de page)
        // La restauration du layout sera faite plus tard via App.svelte après le chargement des outils
    if (authManager.isAuthenticated && authManager.currentUser) {
      syncFromManager()
    }
        
        initialized = true
        syncFromManager(true)
      } catch (err) {
        authError('AuthStore initialization error', err)
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
        
        authDebug('Starting login', { providerId })
        const result = await authManager.login(providerId)
        
        if (result.redirected) {
          // Le provider a redirigé vers OAuth, pas besoin de mise à jour réactive ici
          authDebug('Redirected to provider OAuth', { providerId })
          return result
        }
        
        if (result.success) {
          syncFromManager()
          authDebug('Login successful', { providerId })
          
          // Restaurer le layout utilisateur après une authentification réussie
          if (currentUser) {
            try {
              const ideStore = await getIdeStore()
              await ideStore.restoreUserLayout(currentUser)
            } catch (layoutError) {
              authWarn('Failed to restore user layout', layoutError)
            }
          }
        } else {
          error = result.error
        }
        
        return result
      } catch (err) {
        authError('AuthStore login error', err)
        error = err.message
        throw err
      } finally {
        isLoading = false
      }
    },

    async logout() {
      try {
        isLoading = true
        error = null
        
        authDebug('Starting logout')
        const result = await authManager.logout()
        
        syncFromManager()
        
        authDebug('Logout completed')
        return result
      } catch (err) {
        authError('AuthStore logout error', err)
        error = err.message
        throw err
      } finally {
        isLoading = false
      }
    },

    getAccessToken() {
      return authManager.getAccessToken()
    },

    async refreshToken() {
      try {
        authDebug('Manual token refresh requested')
        const result = await authManager.refreshToken()
        
        if (!result.success) {
          error = result.error
          syncFromManager()
        }
        
        return result
      } catch (err) {
        authError('AuthStore token refresh error', err)
        error = err.message
        throw err
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

  // Enregistrer la référence du store dans AuthManager
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
