import { AuthProvider } from '../AuthProvider.svelte.js'

export class MockProvider extends AuthProvider {
  constructor(config = {}) {
    super()
    
    this.id = 'mock'
    this.name = 'Mock Provider'
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

  get isConfigured() {
    return true
  }

  validateConfig() {
    return true
  }

  async initialize() {
    
  }

  async login() {
    if (this.config.simulateDelay > 0) {
      await new Promise(resolve => setTimeout(resolve, this.config.simulateDelay))
    }

    if (this.config.shouldFail) {
      throw new Error('Mock authentication failed (simulated)')
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

    return {
      success: true,
      tokens: mockTokens,
      userInfo
    }
  }

  async logout() {
    if (this.config.simulateDelay > 0) {
      await new Promise(resolve => setTimeout(resolve, 500))
    }
    
    return { success: true }
  }

  async refreshToken(refreshToken) {
    if (this.config.simulateDelay > 0) {
      await new Promise(resolve => setTimeout(resolve, 800))
    }

    if (!refreshToken || !refreshToken.startsWith('mock_refresh_token_')) {
      throw new Error('Invalid refresh token')
    }

    const newTokens = {
      accessToken: 'mock_access_token_refreshed_' + Date.now(),
      refreshToken: refreshToken,
      expiresIn: 3600
    }

    return {
      success: true,
      tokens: newTokens,
      userInfo: this.config.userInfo
    }
  }

  async getUserInfo(accessToken) {
    return this.config.userInfo
  }
}
