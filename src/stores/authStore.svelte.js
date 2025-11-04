import { AuthManager } from '@/core/auth/AuthManager.svelte.js'
import { AzureProvider, GoogleProvider, MockProvider } from '@/core/auth/providers/index.js'

function getIdeStore() {
  return import('@/stores/ideStore.svelte.js').then(module => module.ideStore)
}

function initializeAuthProviders(authManager) {
  const enabledProviders = import.meta.env.VITE_AUTH_PROVIDERS?.split(',') || []
  let hasRealProviders = false

  console.log('AuthStore: Enabled providers:', enabledProviders)

  if (enabledProviders.includes('azure')) {
    const azureConfig = {
      clientId: import.meta.env.VITE_AZURE_CLIENT_ID,
      tenantId: import.meta.env.VITE_AZURE_TENANT_ID
    }
    
    console.log('AuthStore: Azure config check:', { 
      hasClientId: !!azureConfig.clientId, 
      hasTenantId: !!azureConfig.tenantId 
    })
    
    if (azureConfig.clientId && azureConfig.tenantId) {
      authManager.registerProvider(new AzureProvider(azureConfig))
      hasRealProviders = true
      console.log('AuthStore: Azure provider registered')
    } else {
      console.log('AuthStore: Azure provider skipped - missing configuration')
    }
  }

  if (enabledProviders.includes('google')) {
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
    
    console.log('AuthStore: Google config check:', { 
      hasClientId: !!googleConfig.clientId,
      hasBackendTokenUrl: !!googleConfig.backendTokenUrl,
      backendModeFlag: googleConfig.useBackendExchange,
      hasClientSecret: !!googleConfig.clientSecret,
      allowInsecureClientSecret: googleConfig.allowInsecureClientSecret
    })
    
    if (googleConfig.clientId) {
      const useBackend = googleConfig.useBackendExchange || !!googleConfig.backendTokenUrl || !!googleConfig.backendRefreshUrl
      if (useBackend && !googleConfig.backendTokenUrl) {
        console.warn('AuthStore: Google provider skipped - backend exchange enabled but VITE_GOOGLE_BACKEND_TOKEN_URL is missing')
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
            console.warn('AuthStore: Google clientSecret provided but VITE_GOOGLE_ALLOW_INSECURE_SECRET is not true; secret will be ignored.')
          } else {
            providerConfig.clientSecret = googleConfig.clientSecret
            providerConfig.allowInsecureClientSecret = true
          }
        }
        
        authManager.registerProvider(new GoogleProvider(providerConfig))
        hasRealProviders = true
        console.log('AuthStore: Google provider registered')
      }
    } else {
      console.log('AuthStore: Google provider skipped - missing clientId')
    }
  }

  // Ajouter le MockProvider par défaut si aucun vrai provider n'est configuré
  if (!hasRealProviders) {
    console.log('AuthStore: No real providers configured, using MockProvider')
    const mockConfig = {
      simulateDelay: import.meta.env.VITE_MOCK_AUTH_DELAY ? parseInt(import.meta.env.VITE_MOCK_AUTH_DELAY) : 1000,
      userInfo: {
        id: 'mock-dev-user',
        name: 'Développeur Mock',
        email: 'dev@svelte-ide.local',
        avatar: '👨‍💻'
      }
    }
    
    authManager.registerProvider(new MockProvider(mockConfig))
    console.log('AuthStore: MockProvider registered as fallback')
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

  function syncFromManager(forceProviders = false) {
    isAuthenticated = authManager.isAuthenticated
    currentUser = authManager.currentUser
    if (forceProviders || initialized) {
      availableProviders = authManager.getAvailableProviders()
    }
  }

  return {
    get isAuthenticated() { return isAuthenticated },
    get currentUser() { return currentUser },
    get isLoading() { return isLoading },
    get error() { return error },
    get availableProviders() { return availableProviders },
    get initialized() { return initialized },

    async initialize() {
      if (initialized || initializing) {
        return
      }

      try {
        initializing = true
        isLoading = true
        error = null
        
        initializeAuthProviders(authManager)
        await authManager.initializeProviders()
        
        // Vérifier si on est dans un callback OAuth
        const currentPath = window.location.pathname
        if (currentPath.startsWith('/auth/') && currentPath.includes('/callback') || window.location.search.includes('code=')) {
          console.log('AuthStore: Detected OAuth callback, delegating to AuthManager')
          const result = await authManager.handleCallback()
          
          if (result.success) {
            syncFromManager()

            // Restaurer le layout utilisateur après une authentification réussie
            if (currentUser) {
              try {
                const ideStore = await getIdeStore()
                await ideStore.restoreUserLayout(currentUser)
              } catch (layoutError) {
                console.warn('AuthStore: Failed to restore user layout:', layoutError)
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
        console.error('AuthStore: Initialization error:', err)
        error = err.message
      } finally {
        isLoading = false
        initializing = false
      }
    },

    async login(providerId) {
      try {
        isLoading = true
        error = null
        
        console.log(`AuthStore: Starting login with ${providerId}`)
        const result = await authManager.login(providerId)
        
        if (result.redirected) {
          // Le provider a redirigé vers OAuth, pas besoin de mise à jour réactive ici
          console.log(`AuthStore: Redirected to ${providerId} OAuth`)
          return result
        }
        
        if (result.success) {
          syncFromManager()
          console.log(`AuthStore: Login successful with ${providerId}`)
          
          // Restaurer le layout utilisateur après une authentification réussie
          if (currentUser) {
            try {
              const ideStore = await getIdeStore()
              await ideStore.restoreUserLayout(currentUser)
            } catch (layoutError) {
              console.warn('AuthStore: Failed to restore user layout:', layoutError)
            }
          }
        } else {
          error = result.error
        }
        
        return result
      } catch (err) {
        console.error('AuthStore: Login error:', err)
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
        
        console.log('AuthStore: Starting logout')
        const result = await authManager.logout()
        
        syncFromManager()
        
        console.log('AuthStore: Logout completed')
        return result
      } catch (err) {
        console.error('AuthStore: Logout error:', err)
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
        console.log('AuthStore: Refreshing token')
        const result = await authManager.refreshToken()
        
        if (!result.success) {
          error = result.error
          syncFromManager()
        }
        
        return result
      } catch (err) {
        console.error('AuthStore: Token refresh error:', err)
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
    }
  }
}

let _authStore = null

export function getAuthStore() {
  if (!_authStore) {
    _authStore = createAuthStore()
  }
  return _authStore
}
