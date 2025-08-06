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
  }

  getAvailableProviders() {
    return Array.from(this.providers.values()).map(provider => ({
      id: provider.id,
      name: provider.name,
      icon: provider.icon
    }))
  }

  async login(providerId) {
    const provider = this.providers.get(providerId)
    if (!provider) {
      throw new Error(`Provider ${providerId} not found`)
    }

    try {
      const result = await provider.login()
      
      if (result.success && result.tokens) {
        this.tokenManager.setTokens(
          result.tokens.accessToken,
          result.tokens.refreshToken,
          result.tokens.expiresIn,
          result.userInfo
        )
        this.activeProvider = provider
        this._isAuthenticated = true
        this._currentUser = result.userInfo
        
        return { success: true, user: result.userInfo }
      }
      
      throw new Error(result.error || 'Login failed')
    } catch (error) {
      throw error
    }
  }

  async logout() {
    try {
      if (this.activeProvider) {
        await this.activeProvider.logout()
      }
    } catch (error) {
      
    }
    
    this.tokenManager.clear()
    this.activeProvider = null
    this._isAuthenticated = false
    this._currentUser = null
  }

  getAccessToken() {
    return this.tokenManager.getAccessToken()
  }

  async refreshToken() {
    if (!this.activeProvider) {
      throw new Error('No active provider for token refresh')
    }

    try {
      const refreshToken = this.tokenManager.getRefreshToken()
      if (!refreshToken) {
        throw new Error('No refresh token available')
      }

      const result = await this.activeProvider.refreshToken(refreshToken)
      
      if (result.success && result.tokens) {
        this.tokenManager.setTokens(result.tokens, result.userInfo || this._currentUser)
        return result.tokens.accessToken
      }
      
      throw new Error(result.error || 'Token refresh failed')
    } catch (error) {
      this._isAuthenticated = false
      this._currentUser = null
      this.tokenManager.clear()
      throw error
    }
  }

  async initializeProviders() {
    
  }
}
