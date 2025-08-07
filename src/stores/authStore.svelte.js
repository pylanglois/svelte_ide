import { AuthManager } from '@/core/auth/AuthManager.svelte.js'
import { AzureProvider, GoogleProvider, MockProvider } from '@/core/auth/providers/index.js'

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
    const googleConfig = {
      clientId: import.meta.env.VITE_GOOGLE_CLIENT_ID,
      clientSecret: import.meta.env.VITE_GOOGLE_CLIENT_SECRET
    }
    
    console.log('AuthStore: Google config check:', { 
      hasClientId: !!googleConfig.clientId,
      hasClientSecret: !!googleConfig.clientSecret
    })
    
    if (googleConfig.clientId && googleConfig.clientSecret) {
      authManager.registerProvider(new GoogleProvider(googleConfig))
      hasRealProviders = true
      console.log('AuthStore: Google provider registered')
    } else {
      console.log('AuthStore: Google provider skipped - missing clientId or clientSecret')
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

  $effect(() => {
    isAuthenticated = authManager.isAuthenticated
  })

  $effect(() => {
    currentUser = authManager.currentUser
  })

  $effect(() => {
    if (initialized) {
      availableProviders = authManager.getAvailableProviders()
    }
  })

  return {
    get isAuthenticated() { return isAuthenticated },
    get currentUser() { return currentUser },
    get isLoading() { return isLoading },
    get error() { return error },
    get availableProviders() { return availableProviders },
    get initialized() { return initialized },

    async initialize() {
      if (initialized || initializing) {
        console.log('AuthStore: Already initialized or initializing, skipping')
        return
      }

      try {
        initializing = true
        isLoading = true
        error = null
        
        console.log('AuthStore: Initializing...')
        initializeAuthProviders(authManager)
        await authManager.initializeProviders()
        
        // Vérifier si on est dans un callback OAuth
        const currentPath = window.location.pathname
        if (currentPath.startsWith('/auth/') && currentPath.includes('/callback') || window.location.search.includes('code=')) {
          console.log('AuthStore: Detected OAuth callback, delegating to AuthManager')
          const result = await authManager.handleCallback()
          
          if (result.success) {
            // Forcer la mise à jour réactive
            isAuthenticated = authManager.isAuthenticated
            currentUser = authManager.currentUser
          } else if (result.error) {
            error = result.error
          }
        }
        
        initialized = true
        availableProviders = authManager.getAvailableProviders()
        console.log('AuthStore: Initialization completed')
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
          // Forcer la mise à jour réactive pour les providers synchrones (comme MockProvider)
          isAuthenticated = authManager.isAuthenticated
          currentUser = authManager.currentUser
          console.log(`AuthStore: Login successful with ${providerId}`)
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
        
        // Forcer la mise à jour réactive
        isAuthenticated = authManager.isAuthenticated
        currentUser = authManager.currentUser
        
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
          // Forcer la mise à jour réactive si la session a expiré
          isAuthenticated = authManager.isAuthenticated
          currentUser = authManager.currentUser
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
        availableProviders = authManager.getAvailableProviders()
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
