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
        
        // Vérifier si on est dans un callback OAuth
        if (window.location.pathname === '/auth/callback' || window.location.search.includes('code=')) {
          await this.handleOAuthCallback()
        }
        
        initialized = true
        availableProviders = authManager.getAvailableProviders()
      } catch (err) {
        error = err.message
      } finally {
        isLoading = false
      }
    },

    async handleOAuthCallback() {
      // Empêcher les appels multiples
      if (this._handlingCallback) {
        console.log('OAuth callback already in progress, skipping')
        return
      }
      
      this._handlingCallback = true
      
      try {
        console.log('Handling OAuth callback:', { 
          pathname: window.location.pathname,
          search: window.location.search,
          hash: window.location.hash,
          availableProviders: Array.from(authManager.providers.keys())
        })
        
        // Trouver le provider qui peut gérer ce callback
        for (const [id, provider] of authManager.providers) {
          if (window.location.search.includes('code=')) {
            // Détecter le provider basé sur l'URL de callback ou les paramètres
            let isProviderCallback = false
            
            if (provider.id === 'azure') {
              // Azure callback detection
              isProviderCallback = true
            } else if (provider.id === 'google') {
              // Google callback detection
              isProviderCallback = true
            }
            
            if (isProviderCallback) {
              console.log(`Found ${provider.id} provider for callback`)
              const result = await provider.handleCallback()
              
              if (result) {
                console.log(`${provider.id} callback successful:`, { 
                  userInfo: result.userInfo,
                  userInfoName: result.userInfo?.name,
                  userInfoEmail: result.userInfo?.email 
                })
                
                authManager.tokenManager.setTokens(
                  result.accessToken,
                  result.refreshToken,
                  result.expiresIn,
                  result.userInfo
                )
                authManager.activeProvider = provider
                authManager._isAuthenticated = true
                authManager._currentUser = result.userInfo
                
                // Forcer la mise à jour réactive
                isAuthenticated = true
                currentUser = result.userInfo
                
                // Nettoyer complètement l'URL en redirigeant vers la racine
                window.history.replaceState({}, document.title, window.location.origin + '/')
                
                return
              }
            }
          }
        }
        
        throw new Error('No provider found to handle callback')
      } catch (err) {
        console.error('OAuth callback error:', err)
        error = err.message
        
        // Nettoyer l'URL en redirigeant vers la racine même en cas d'erreur
        window.history.replaceState({}, document.title, window.location.origin + '/')
        
        // S'assurer que l'état de loading est réinitialisé
        isLoading = false
        
        // En cas d'erreur state, nettoyer les sessions
        if (err.message.includes('Invalid state parameter')) {
          sessionStorage.removeItem('oauth_state')
          sessionStorage.removeItem('oauth_code_verifier')
          console.log('Cleared OAuth session storage due to state error')
        }
        
        throw err
      } finally {
        this._handlingCallback = false
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
