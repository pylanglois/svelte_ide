import { AuthManager } from '@/core/auth/AuthManager.svelte.js'
import { AzureProvider, GoogleProvider, MockProvider } from '@/core/auth/providers/index.js'

function initializeAuthProviders(authManager) {
  const enabledProviders = import.meta.env.VITE_AUTH_PROVIDERS?.split(',') || []
  let hasRealProviders = false

  if (enabledProviders.includes('azure')) {
    const azureConfig = {
      clientId: import.meta.env.VITE_AZURE_CLIENT_ID,
      tenantId: import.meta.env.VITE_AZURE_TENANT_ID,
      redirectUri: import.meta.env.VITE_AZURE_REDIRECT_URI || `${window.location.origin}/auth/callback`
    }
    
    if (azureConfig.clientId && azureConfig.tenantId) {
      authManager.registerProvider(new AzureProvider(azureConfig))
      hasRealProviders = true
    }
  }

  if (enabledProviders.includes('google')) {
    const googleConfig = {
      clientId: import.meta.env.VITE_GOOGLE_CLIENT_ID,
      clientSecret: import.meta.env.VITE_GOOGLE_CLIENT_SECRET,
      redirectUri: import.meta.env.VITE_GOOGLE_REDIRECT_URI || `${window.location.origin}/auth/callback`
    }
    
    if (googleConfig.clientId && googleConfig.clientSecret) {
      authManager.registerProvider(new GoogleProvider(googleConfig))
      hasRealProviders = true
    }
  }

  // Ajouter le MockProvider par défaut si aucun vrai provider n'est configuré
  if (!hasRealProviders) {
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
      if (initialized) return

      try {
        isLoading = true
        error = null
        
        initializeAuthProviders(authManager)
        await authManager.initializeProviders()
        
        initialized = true
        availableProviders = authManager.getAvailableProviders()
      } catch (err) {
        error = err.message
      } finally {
        isLoading = false
      }
    },

    async login(providerId) {
      try {
        isLoading = true
        error = null
        
        const result = await authManager.login(providerId)
        
        // Forcer la mise à jour réactive
        isAuthenticated = authManager.isAuthenticated
        currentUser = authManager.currentUser
        
        return result
      } catch (err) {
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
        
        await authManager.logout()
        
        // Forcer la mise à jour réactive
        isAuthenticated = authManager.isAuthenticated
        currentUser = authManager.currentUser
      } catch (err) {
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
        return await authManager.refreshToken()
      } catch (err) {
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
