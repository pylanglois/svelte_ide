import { AuthProvider } from '@/core/auth/AuthProvider.svelte.js'

export class MockProvider extends AuthProvider {
  constructor(config = {}) {
    super('mock', 'Mock Provider', config)
    this.icon = '🧪'
    this.config = {
      simulateDelay: config.simulateDelay ?? 1000,
      shouldFail: config.shouldFail ?? false,
      userInfo: config.userInfo ?? {
        id: 'mock-user-123',
        name: 'John Doe',
        email: 'john.doe@example.com',
        avatar: '👨‍💻'
      },
      ...config
    }
  }

  requiredConfigKeys() {
    return []
  }

  canHandleCallback(currentPath) {
    // MockProvider ne gère pas de callback OAuth réel
    return false
  }

  async initialize() {
    await super.initialize()
  }

  async login() {
    console.log('MockProvider: Starting mock authentication')
    
    if (this.config.simulateDelay > 0) {
      console.log(`MockProvider: Simulating ${this.config.simulateDelay}ms delay`)
      await new Promise(resolve => setTimeout(resolve, this.config.simulateDelay))
    }

    if (this.config.shouldFail) {
      console.log('MockProvider: Simulating authentication failure')
      return {
        success: false,
        error: 'Mock authentication failed (simulated)'
      }
    }

    const mockTokens = {
      accessToken: 'mock_access_token_' + Date.now(),
      refreshToken: 'mock_refresh_token_' + Date.now(),
      expiresIn: 3600
    }

    const userInfo = {
      ...this.config.userInfo,
      provider: 'mock',
      loginTime: new Date().toISOString()
    }

    console.log('MockProvider: Authentication successful')
    return {
      success: true,
      tokens: mockTokens,
      userInfo
    }
  }

  async handleOwnCallback() {
    // MockProvider ne devrait jamais être appelé pour un callback
    console.warn('MockProvider: handleOwnCallback called but MockProvider does not handle OAuth callbacks')
    return {
      success: false,
      error: 'MockProvider does not handle OAuth callbacks'
    }
  }

  async logout() {
    console.log('MockProvider: Starting logout')
    
    if (this.config.simulateDelay > 0) {
      await new Promise(resolve => setTimeout(resolve, 500))
    }
    
    console.log('MockProvider: Logout completed')
    return { success: true }
  }

  async refreshToken(refreshToken) {
    console.log('MockProvider: Refreshing token')
    
    if (this.config.simulateDelay > 0) {
      await new Promise(resolve => setTimeout(resolve, 800))
    }

    if (!refreshToken || !refreshToken.startsWith('mock_refresh_token_')) {
      return {
        success: false,
        error: 'Invalid refresh token'
      }
    }

    const newTokens = {
      accessToken: 'mock_access_token_refreshed_' + Date.now(),
      refreshToken: refreshToken,
      expiresIn: 3600
    }

    console.log('MockProvider: Token refresh successful')
    return {
      success: true,
      tokens: newTokens
    }
  }
}
