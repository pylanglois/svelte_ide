export class AuthProvider {
  constructor(providerId, displayName, config = {}) {
    this.id = providerId
    this.name = displayName
    this.config = config
    this.isConfigured = $state(false)
    this.isInitialized = $state(false)
    
    this.validateConfig()
  }

  validateConfig() {
    this.isConfigured = this.requiredConfigKeys().every(key => 
      this.config[key] && this.config[key].trim() !== ''
    )
  }

  requiredConfigKeys() {
    return []
  }

  getCallbackPath() {
    return `/auth/${this.id}/callback`
  }

  getRedirectUri() {
    return `${window.location.origin}${this.getCallbackPath()}`
  }

  canHandleCallback(currentPath) {
    return currentPath === this.getCallbackPath() || 
           (currentPath === '/auth/callback' && window.location.search.includes('state='))
  }

  async initialize() {
    if (!this.isConfigured) {
      throw new Error(`Provider ${this.id} is not properly configured`)
    }
    this.isInitialized = true
  }

  async login() {
    throw new Error('login() must be implemented by provider')
  }

  async handleOwnCallback() {
    throw new Error('handleOwnCallback() must be implemented by provider')
  }

  async logout() {
    return { success: true }
  }

  async refreshToken(refreshToken) {
    throw new Error('refreshToken() must be implemented by provider')
  }

  generateState() {
    return Math.random().toString(36).substring(2, 15) + 
           Math.random().toString(36).substring(2, 15)
  }

  generateCodeVerifier() {
    const array = new Uint8Array(32)
    crypto.getRandomValues(array)
    return btoa(String.fromCharCode.apply(null, array))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '')
  }

  async generateCodeChallenge(verifier) {
    const data = new TextEncoder().encode(verifier)
    const digest = await crypto.subtle.digest('SHA-256', data)
    return btoa(String.fromCharCode.apply(null, new Uint8Array(digest)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '')
  }

  getStorageKey(suffix) {
    return `${this.id}_oauth_${suffix}`
  }
}
