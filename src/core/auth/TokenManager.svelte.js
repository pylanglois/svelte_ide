export class TokenManager {
  constructor() {
    this.accessToken = null
    this.refreshToken = null
    this.tokenExpiry = null
    this.userInfo = null
    this.refreshTimer = null
    
    this.loadFromStorage()
    this.setupAutoRefresh()
  }

  loadFromStorage() {
    try {
      const stored = localStorage.getItem('auth_tokens')
      if (stored) {
        const data = JSON.parse(stored)
        if (data.expiry && new Date(data.expiry) > new Date()) {
          this.accessToken = data.accessToken
          this.refreshToken = data.refreshToken  
          this.tokenExpiry = new Date(data.expiry)
          this.userInfo = data.userInfo
        } else {
          this.clearStorage()
        }
      }
    } catch (error) {
      this.clearStorage()
    }
  }

  saveToStorage() {
    if (this.accessToken && this.tokenExpiry) {
      const data = {
        accessToken: this.accessToken,
        refreshToken: this.refreshToken,
        expiry: this.tokenExpiry.toISOString(),
        userInfo: this.userInfo
      }
      localStorage.setItem('auth_tokens', JSON.stringify(data))
    }
  }

  clearStorage() {
    localStorage.removeItem('auth_tokens')
    this.accessToken = null
    this.refreshToken = null
    this.tokenExpiry = null
    this.userInfo = null
  }

  setTokens(accessToken, refreshToken, expiresIn, userInfo = null) {
    this.accessToken = accessToken
    this.refreshToken = refreshToken
    this.tokenExpiry = new Date(Date.now() + (expiresIn * 1000))
    this.userInfo = userInfo
    
    this.saveToStorage()
    this.setupAutoRefresh()
  }

  getAccessToken() {
    if (!this.accessToken || !this.tokenExpiry) {
      return null
    }
    
    if (new Date() >= this.tokenExpiry) {
      return null
    }
    
    return this.accessToken
  }

  getRefreshToken() {
    return this.refreshToken
  }

  isTokenValid() {
    return this.accessToken && 
           this.tokenExpiry && 
           new Date() < this.tokenExpiry
  }

  setupAutoRefresh() {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer)
    }

    if (this.tokenExpiry && this.refreshToken) {
      const refreshTime = this.tokenExpiry.getTime() - Date.now() - (5 * 60 * 1000)
      
      if (refreshTime > 0) {
        this.refreshTimer = setTimeout(() => {
          
        }, refreshTime)
      }
    }
  }

  clear() {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer)
      this.refreshTimer = null
    }
    this.clearStorage()
  }
}
