import { authDebug, authError, authWarn } from '@svelte-ide/core/auth/authLogging.svelte.js'
import { avatarCacheService } from '@svelte-ide/core/auth/AvatarCacheService.svelte.js'
import { deriveEncryptionKey } from '@svelte-ide/core/auth/EncryptionKeyDerivation.svelte.js'
import { TokenManager } from '@svelte-ide/core/auth/TokenManager.svelte.js'

export class AuthManager {
  constructor() {
    this.providers = new Map()
    this.activeProvider = null
    this.tokenManager = new TokenManager()
    this._isAuthenticated = false
    this._currentUser = null
    this._authStoreRef = null
    
    this.tokenManager.setAutoRefreshHandler(() => {
      return this.refreshToken().catch(error => {
        authWarn('Auto-refresh failed', error)
        return { success: false, error: error.message }
      })
    })

    this.tokenManager.setSessionExpiredHandler(() => {
      return this.handleSessionExpired()
    })

    this.ready = this.tokenManager.ready.then(() => {
      return this.initializeAuthState()
    })
  }

  /**
   * Gère l'expiration définitive de la session (après échec de tous les refresh)
   * @private
   */
  async handleSessionExpired() {
    authWarn('Session expired, user needs to re-authenticate')
    
    this._isAuthenticated = false
    this._currentUser = null
    this._clearEncryptionKey()
    this.activeProvider = null

    // Émettre événement pour que l'UI puisse réagir
    if (typeof window !== 'undefined') {
      const { eventBus } = await import('@svelte-ide/core/EventBusService.svelte.js')
      eventBus.publish('auth:session-expired', {
        timestamp: new Date().toISOString(),
        message: 'Votre session a expiré. Veuillez vous reconnecter.'
      })
    }

    if (this._authStoreRef?.handleSessionExpired) {
      try {
        this._authStoreRef.handleSessionExpired({
          message: 'Votre session a expiré. Veuillez vous reconnecter.'
        })
      } catch (storeError) {
        authWarn('Failed to notify authStore about session expiration', storeError)
      }
    }

    // Ajouter notification si ideStore disponible
    try {
      const { ideStore } = await import('@svelte-ide/stores/ideStore.svelte.js')
      ideStore.addNotification({
        type: 'warning',
        message: 'Session expirée',
        description: 'Veuillez vous reconnecter pour continuer.',
        duration: 0 // Persistante
      })
    } catch (error) {
      authWarn('Could not display session expired notification', error)
    }
  }

  /**
   * Enregistre une référence à authStore pour mettre à jour la clé de chiffrement
   * Appelé par authStore lors de son initialisation
   */
  setAuthStoreRef(authStore) {
    this._authStoreRef = authStore
    authDebug('AuthStore reference registered in AuthManager')
  }

  /**
   * Dérive et définit la clé de chiffrement depuis userInfo
   * @private
   */
  async _deriveAndSetEncryptionKey(userInfo) {
    if (!userInfo) {
      authWarn('Cannot derive encryption key: userInfo is null')
      return
    }

    try {
      const encryptionKey = await deriveEncryptionKey(userInfo)
      
      if (this._authStoreRef) {
        this._authStoreRef.setEncryptionKey(encryptionKey)
        authDebug('Encryption key derived and set in authStore')
      } else {
        authWarn('AuthStore reference not available, encryption key not set')
      }
    } catch (error) {
      authError('Failed to derive encryption key', error)
      // Ne pas bloquer l'authentification si la dérivation échoue
      // L'utilisateur pourra quand même se connecter, mais sans chiffrement IndexedDB
    }
  }

  /**
   * Efface la clé de chiffrement de authStore
   * @private
   */
  _clearEncryptionKey() {
    if (this._authStoreRef) {
      this._authStoreRef.clearEncryptionKey()
      authDebug('Encryption key cleared from authStore')
    }
  }

  get isAuthenticated() {
    return this._isAuthenticated
  }

  get currentUser() {
    return this._currentUser
  }

  async initializeAuthState() {
    await this.tokenManager.ready

    const accessToken = this.tokenManager.getAccessToken()
    if (accessToken) {
      this._isAuthenticated = true
      this._currentUser = this.tokenManager.userInfo
      
      // Note: activeProvider sera restauré plus tard dans initializeProviders()
      // car les providers ne sont pas encore enregistrés à ce stade
      
      // Restaurer l'avatar depuis le cache (les blob URLs ne survivent pas au reload)
      if (this._currentUser?.sub) {
        try {
          const cachedAvatar = await avatarCacheService.getAvatar(this._currentUser.sub)
          if (cachedAvatar) {
            this._currentUser.avatar = cachedAvatar
            authDebug('User avatar restored from cache after page reload')
          }
        } catch (error) {
          authDebug('Failed to restore avatar from cache (non-blocking)', error)
        }
      }
      
      // Dériver la clé de chiffrement si userInfo disponible
      if (this._currentUser) {
        await this._deriveAndSetEncryptionKey(this._currentUser)
      }
    }
  }

  registerProvider(provider) {
    if (!provider || !provider.id) {
      throw new Error('Invalid provider')
    }
    this.providers.set(provider.id, provider)
    authDebug('Registered provider', { providerId: provider.id })
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
        authDebug('Found provider for callback', { providerId: id, path: currentPath })
        return provider
      }
    }
    authDebug('No provider found for callback path', { path: currentPath })
    return null
  }

  async handleCallback() {
    await this.tokenManager.ready

    const currentPath = window.location.pathname
    authDebug('Handling callback', { path: currentPath })
    
    const provider = this.findProviderForCallback(currentPath)
    
    if (!provider) {
      authWarn('No provider can handle this callback', { path: currentPath })
      return {
        success: false,
        error: 'No provider found for this callback URL'
      }
    }

    authDebug('Delegating callback to provider', { providerId: provider.id })
    
    // Vérifier si on a déjà traité ce callback pour éviter les doubles traitements
    const callbackKey = `callback_processed_${provider.id}_${window.location.search}`
    if (sessionStorage.getItem(callbackKey)) {
      authWarn('Callback already processed, skipping', { providerId: provider.id })
      return { success: false, error: 'Callback already processed' }
    }
    
    const result = await provider.handleOwnCallback()
    
    if (result.success) {
      // NOUVEAU : Gérer multi-tokens si le provider retourne plusieurs audiences
      if (result.tokens) {
        // Format multi-tokens : { tokens: [{accessToken, audience, scopes, expiresIn}], refreshToken, idToken }
        if (Array.isArray(result.tokens.accessTokens)) {
          await this.tokenManager.setTokens(
            result.tokens.accessTokens, // Array de tokens
            result.tokens.refreshToken,
            result.userInfo
          )
        }
        // Format legacy : { accessToken, refreshToken, expiresIn }
        else if (result.tokens.accessToken && result.tokens.expiresIn) {
          await this.tokenManager.setTokens(
            result.tokens.accessToken,
            result.tokens.refreshToken,
            result.tokens.expiresIn,
            result.userInfo
          )
        }
      } else {
        await this.tokenManager.clear()
        this.tokenManager.userInfo = result.userInfo || null
      }
      
      this.activeProvider = provider
      this._isAuthenticated = true
      this._currentUser = result.userInfo
      
      // Dériver la clé de chiffrement après login réussi
      await this._deriveAndSetEncryptionKey(result.userInfo)
      
      authDebug('Authentication successful', { providerId: provider.id })
      
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
    await this.tokenManager.ready

    const provider = this.providers.get(providerId)
    if (!provider) {
      return {
        success: false,
        error: `Provider ${providerId} not found`
      }
    }

    authDebug('Starting login', { providerId })
    const result = await provider.login()

    if (result?.redirected) {
      return result
    }

    if (result?.success) {
      if (result.tokens?.accessToken && result.tokens?.expiresIn) {
        await this.tokenManager.setTokens(
          result.tokens.accessToken,
          result.tokens.refreshToken,
          result.tokens.expiresIn,
          result.userInfo ?? null
        )
      } else {
        await this.tokenManager.clear()
        this.tokenManager.userInfo = result.userInfo ?? null
      }

      this.activeProvider = provider
      this._isAuthenticated = true
      this._currentUser = result.userInfo ?? null

      // Dériver la clé de chiffrement après login réussi
      if (this._currentUser) {
        await this._deriveAndSetEncryptionKey(this._currentUser)
      }

      authDebug('Login completed successfully', { providerId })
    }

    return result
  }

  async logout() {
    await this.tokenManager.ready

    authDebug('Starting logout')
    
    const userId = this._currentUser?.sub
    
    // Nettoyer l'état local AVANT de rediriger vers le provider
    // Cela garantit que l'état est clean même si l'utilisateur revient avant la fin du logout
    await this.tokenManager.clear()
    const previousProvider = this.activeProvider
    this.activeProvider = null
    this._isAuthenticated = false
    this._currentUser = null
    
    // Effacer la clé de chiffrement lors du logout
    this._clearEncryptionKey()
    
    // ✅ NE PAS supprimer le cache d'avatar pour permettre le fallback lors du prochain login
    // Le cache persistant offre de la résilience si Graph API est indisponible
    // Le TTL de 24h gère automatiquement l'expiration
    
    authDebug('Local state cleared, delegating to provider logout')
    
    // Appeler le logout du provider EN DERNIER car il peut rediriger
    // et empêcher l'exécution du code qui suit
    try {
      if (previousProvider) {
        const result = await previousProvider.logout()
        // Si le provider redirige (Azure), ce code ne sera jamais atteint
        authDebug('Logout completed')
        return result
      }
    } catch (error) {
      authWarn('Provider logout failed', error)
    }
    
    authDebug('Logout completed')
    return { success: true }
  }

  getAccessToken() {
    return this.tokenManager.getAccessToken()
  }

  async refreshToken() {
    await this.tokenManager.ready

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

      authDebug('Refreshing token', { providerId: this.activeProvider.id })
      const result = await this.activeProvider.refreshToken(refreshToken)
      
      if (result.success) {
        // Support multi-tokens refresh
        if (result.tokens?.accessTokens && Array.isArray(result.tokens.accessTokens)) {
          await this.tokenManager.setTokens(
            result.tokens.accessTokens,
            result.tokens.refreshToken || refreshToken,
            this._currentUser
          )
        } else if (result.tokens?.accessToken && result.tokens?.expiresIn) {
          await this.tokenManager.setTokens(
            result.tokens.accessToken,
            result.tokens.refreshToken || refreshToken,
            result.tokens.expiresIn,
            this._currentUser
          )
        } else {
          authWarn('Refresh response missing tokens payload')
          return {
            success: false,
            error: 'No tokens returned by provider'
          }
        }
        
        // Re-dériver la clé de chiffrement après refresh
        // (normalement userInfo ne change pas, mais on régénère par sécurité)
        if (this._currentUser) {
          await this._deriveAndSetEncryptionKey(this._currentUser)
        }
        
        authDebug('Token refresh successful', { providerId: this.activeProvider.id })
        return { success: true, accessToken: this.tokenManager.getAccessToken() }
      }
      
      authError('Token refresh failed', result.error)
      this._isAuthenticated = false
      this._currentUser = null
      this._clearEncryptionKey()
      await this.tokenManager.clear()
      
      return result
    } catch (error) {
      authError('Token refresh error', error)
      this._isAuthenticated = false
      this._currentUser = null
      this._clearEncryptionKey()
      await this.tokenManager.clear()
      
      return {
        success: false,
        error: error.message
      }
    }
  }

  async initializeProviders() {
    authDebug('Initializing providers')
    const successfulProviders = []
    const failedProviders = []
    
    for (const [id, provider] of this.providers) {
      try {
        await provider.initialize()
        successfulProviders.push(id)
        authDebug('Provider initialized', { providerId: id })
      } catch (error) {
        failedProviders.push({ id, error: error.message })
        authWarn('Failed to initialize provider', { providerId: id, error: error.message })
        // Retirer le provider défaillant
        this.providers.delete(id)
      }
    }
    
    authDebug('Initialization complete', {
      successful: successfulProviders.length,
      failed: failedProviders.length
    })
    
    if (this.providers.size === 0) {
      authWarn('No providers available after initialization')
      return
    }
    
    // Restaurer le provider actif si l'utilisateur est authentifié (après rechargement de page)
    if (this._isAuthenticated && this._currentUser?.provider && !this.activeProvider) {
      this.activeProvider = this.providers.get(this._currentUser.provider)
      if (this.activeProvider) {
        authDebug('Active provider restored after page reload', { 
          providerId: this._currentUser.provider 
        })
      } else {
        authWarn('Cannot restore active provider: provider not registered', { 
          providerId: this._currentUser.provider 
        })
      }
    }
  }
}
