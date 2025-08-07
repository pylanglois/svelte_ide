import { TokenManager } from '@/core/auth/TokenManager.svelte.js'

export class AuthManager {
  constructor() {
    this.providers = new Map()
    this.activeProvider = null
    this.tokenManager = new TokenManager()
    this._isAuthenticated = false
    this._currentUser = null
    
    this.initializeAuthState()
  }

  get isAuthenticated() {
    return this._isAuthenticated
  }

  get currentUser() {
    return this._currentUser
  }

  initializeAuthState() {
    const accessToken = this.tokenManager.getAccessToken()
    if (accessToken) {
      this._isAuthenticated = true
      this._currentUser = this.tokenManager.userInfo
    }
  }

  registerProvider(provider) {
    if (!provider || !provider.id) {
      throw new Error('Invalid provider')
    }
    this.providers.set(provider.id, provider)
    console.log(`AuthManager: Registered provider ${provider.id}`)
  }

  getAvailableProviders() {
    return Array.from(this.providers.values()).map(provider => ({
      id: provider.id,
      name: provider.name,
      icon: provider.icon
    }))
  }

  findProviderForCallback(currentPath) {
    for (const [id, provider] of this.providers) {
      if (provider.canHandleCallback(currentPath)) {
        console.log(`AuthManager: Found provider ${id} for callback path ${currentPath}`)
        return provider
      }
    }
    console.log(`AuthManager: No provider found for callback path ${currentPath}`)
    return null
  }

  async handleCallback() {
    const currentPath = window.location.pathname
    console.log(`AuthManager: Handling callback for path ${currentPath}`)
    
    const provider = this.findProviderForCallback(currentPath)
    
    if (!provider) {
      console.log('AuthManager: No provider can handle this callback')
      return {
        success: false,
        error: 'No provider found for this callback URL'
      }
    }

    console.log(`AuthManager: Delegating callback to ${provider.id}`)
    
    // Vérifier si on a déjà traité ce callback pour éviter les doubles traitements
    const callbackKey = `callback_processed_${provider.id}_${window.location.search}`
    if (sessionStorage.getItem(callbackKey)) {
      console.log(`AuthManager: Callback already processed for ${provider.id}, skipping`)
      return { success: false, error: 'Callback already processed' }
    }
    
    const result = await provider.handleOwnCallback()
    
    if (result.success) {
      this.tokenManager.setTokens(
        result.tokens.accessToken,
        result.tokens.refreshToken,
        result.tokens.expiresIn,
        result.userInfo
      )
      this.activeProvider = provider
      this._isAuthenticated = true
      this._currentUser = result.userInfo
      
      console.log(`AuthManager: Authentication successful with ${provider.id}`)
      
      // Marquer ce callback comme traité
      sessionStorage.setItem(callbackKey, 'true')
      
      // Nettoyer l'URL et rediriger vers la racine
      window.history.replaceState({}, document.title, window.location.origin + '/')
      
      // Nettoyer le marqueur après redirection
      setTimeout(() => sessionStorage.removeItem(callbackKey), 100)
    }
    
    return result
  }

  async login(providerId) {
    const provider = this.providers.get(providerId)
    if (!provider) {
      return {
        success: false,
        error: `Provider ${providerId} not found`
      }
    }

    console.log(`AuthManager: Starting login with ${providerId}`)
    return await provider.login()
  }

  async logout() {
    console.log('AuthManager: Starting logout')
    
    try {
      if (this.activeProvider) {
        await this.activeProvider.logout()
      }
    } catch (error) {
      console.warn('AuthManager: Provider logout failed:', error)
    }
    
    this.tokenManager.clear()
    this.activeProvider = null
    this._isAuthenticated = false
    this._currentUser = null
    
    console.log('AuthManager: Logout completed')
    
    return { success: true }
  }

  getAccessToken() {
    return this.tokenManager.getAccessToken()
  }

  async refreshToken() {
    if (!this.activeProvider) {
      return {
        success: false,
        error: 'No active provider for token refresh'
      }
    }

    try {
      const refreshToken = this.tokenManager.getRefreshToken()
      if (!refreshToken) {
        return {
          success: false,
          error: 'No refresh token available'
        }
      }

      console.log(`AuthManager: Refreshing token with ${this.activeProvider.id}`)
      const result = await this.activeProvider.refreshToken(refreshToken)
      
      if (result.success) {
        this.tokenManager.setTokens(
          result.tokens.accessToken,
          result.tokens.refreshToken,
          result.tokens.expiresIn,
          this._currentUser
        )
        console.log('AuthManager: Token refresh successful')
        return { success: true, accessToken: result.tokens.accessToken }
      }
      
      console.error('AuthManager: Token refresh failed:', result.error)
      this._isAuthenticated = false
      this._currentUser = null
      this.tokenManager.clear()
      
      return result
    } catch (error) {
      console.error('AuthManager: Token refresh error:', error)
      this._isAuthenticated = false
      this._currentUser = null
      this.tokenManager.clear()
      
      return {
        success: false,
        error: error.message
      }
    }
  }

  async initializeProviders() {
    console.log('AuthManager: Initializing providers...')
    const successfulProviders = []
    const failedProviders = []
    
    for (const [id, provider] of this.providers) {
      try {
        await provider.initialize()
        successfulProviders.push(id)
        console.log(`AuthManager: Provider ${id} initialized successfully`)
      } catch (error) {
        failedProviders.push({ id, error: error.message })
        console.warn(`AuthManager: Failed to initialize provider ${id}:`, error.message)
        // Retirer le provider défaillant
        this.providers.delete(id)
      }
    }
    
    console.log(`AuthManager: Initialization complete - ${successfulProviders.length} successful, ${failedProviders.length} failed`)
    
    if (this.providers.size === 0) {
      console.warn('AuthManager: No providers available after initialization')
    }
  }
}
