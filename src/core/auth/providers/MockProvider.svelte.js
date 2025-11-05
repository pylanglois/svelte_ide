import { AuthProvider } from '@/core/auth/AuthProvider.svelte.js'
import { authDebug, authWarn } from '@/core/auth/authLogging.svelte.js'

export class MockProvider extends AuthProvider {
  constructor(config = {}) {
    super('mock', 'Mock Provider', config)
    this.icon = '🧪'
    this.config = {
      simulateDelay: config.simulateDelay ?? 1000,
      shouldFail: config.shouldFail ?? false,
      userInfo: config.userInfo ?? {
        sub: 'mock-user-123', // Standard OAuth2/OIDC : 'sub' = subject (user ID)
        name: 'John Doe',
        email: 'john.doe@example.com',
        picture: '👨‍💻'
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
    authDebug('Mock provider starting authentication')
    
    if (this.config.simulateDelay > 0) {
      authDebug('Mock provider delay', { delayMs: this.config.simulateDelay })
      await new Promise(resolve => setTimeout(resolve, this.config.simulateDelay))
    }

    if (this.config.shouldFail) {
      authDebug('Mock provider simulating failure')
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

    authDebug('Mock provider authentication successful')
    return {
      success: true,
      tokens: mockTokens,
      userInfo
    }
  }

  async handleOwnCallback() {
    // MockProvider ne devrait jamais être appelé pour un callback
    authWarn('Mock provider callback invoked unexpectedly')
    return {
      success: false,
      error: 'MockProvider does not handle OAuth callbacks'
    }
  }

  async logout() {
    authDebug('Mock provider starting logout')
    
    if (this.config.simulateDelay > 0) {
      await new Promise(resolve => setTimeout(resolve, 500))
    }
    
    authDebug('Mock provider logout completed')
    return { success: true }
  }

  async refreshToken(refreshToken) {
    authDebug('Mock provider refreshing token')
    
    // Hook pour les tests : simuler des échecs de refresh
    if (typeof window !== 'undefined' && window.testAutoRefresh) {
      const shouldFail = window.testAutoRefresh.shouldSimulateRefreshFailure?.()
      if (shouldFail) {
        authWarn('Mock provider simulating refresh failure (test mode)')
        return {
          success: false,
          error: 'Simulated refresh failure for testing'
        }
      }
    }
    
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

    authDebug('Mock provider token refresh successful')
    return {
      success: true,
      tokens: newTokens
    }
  }
}
