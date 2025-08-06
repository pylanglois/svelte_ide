<script>
  import { getAuthStore } from '@/stores/authStore.svelte.js'
  import { ideStore } from '@/stores/ideStore.svelte.js'

  const authStore = getAuthStore()
  
  let userMenu = $state(false)
  let wasAuthenticated = $state(false)

  $effect(() => {
    authStore.initialize()
  })

  $effect(() => {
    if (wasAuthenticated && !authStore.isAuthenticated) {
      ideStore.addNotification(
        'Session expirée',
        'Votre session a expiré, veuillez vous reconnecter',
        'warning',
        'Auth'
      )
    }
    wasAuthenticated = authStore.isAuthenticated
  })

  function toggleUserMenu() {
    userMenu = !userMenu
  }

  async function handleLogin(providerId) {
    try {
      await authStore.login(providerId)
    } catch (error) {
      ideStore.addNotification(
        'Erreur de connexion',
        error.message,
        'error',
        'Auth'
      )
    }
  }

  async function handleLogout() {
    userMenu = false
    try {
      await authStore.logout()
      ideStore.addNotification(
        'Déconnexion',
        'Vous avez été déconnecté avec succès',
        'info',
        'Auth'
      )
    } catch (error) {
      ideStore.addNotification(
        'Erreur de déconnexion',
        error.message,
        'error',
        'Auth'
      )
    }
  }

  function handleClickOutside(e) {
    if (!e.target.closest('.user-section')) {
      userMenu = false
    }
  }

  function getUserAvatar(user) {
    // Pour les URLs d'images, on ne retourne que l'emoji par défaut
    // L'image sera gérée séparément
    return '👤'
  }

  function getUserAvatarImage(user) {
    if (user?.avatar && user.avatar.startsWith('http')) {
      return user.avatar
    }
    return null
  }

  function getUserDisplayName(user) {
    const displayName = user?.name || user?.email || 'Utilisateur'
    console.log('getUserDisplayName called:', { user, displayName })
    return displayName
  }
</script>

<svelte:window onclick={handleClickOutside} />

<div class="user-section">
  {#if authStore.isAuthenticated && authStore.currentUser}
    <button class="user-btn" onclick={toggleUserMenu}>
      <span class="user-avatar">
        {#if getUserAvatarImage(authStore.currentUser)}
          <img src={getUserAvatarImage(authStore.currentUser)} alt="Avatar" />
        {:else}
          {getUserAvatar(authStore.currentUser)}
        {/if}
      </span>
      <span class="username">{getUserDisplayName(authStore.currentUser)}</span>
      <span class="dropdown-arrow" class:rotated={userMenu}>▼</span>
    </button>
    
    {#if userMenu}
      <div class="user-menu">
        <div class="user-info">
          <div class="user-avatar-large">
            {#if getUserAvatarImage(authStore.currentUser)}
              <img src={getUserAvatarImage(authStore.currentUser)} alt="Avatar" />
            {:else}
              {getUserAvatar(authStore.currentUser)}
            {/if}
          </div>
          <div class="user-details">
            <div class="user-name">{getUserDisplayName(authStore.currentUser)}</div>
            <div class="user-status">Connecté via {authStore.currentUser.provider || 'OAuth'}</div>
          </div>
        </div>
        <hr class="menu-separator">
        <button class="menu-item logout-item" onclick={handleLogout}>
          <span class="menu-icon">🚪</span>
          Se déconnecter
        </button>
      </div>
    {/if}
  {:else if authStore.initialized && authStore.availableProviders.length > 0}
    <div class="login-buttons">
      {#each authStore.availableProviders as provider}
        <button class="login-btn" onclick={() => handleLogin(provider.id)} disabled={authStore.isLoading}>
          {#if authStore.isLoading}
            Connexion...
          {:else}
            Se connecter via {provider.name}
          {/if}
        </button>
      {/each}
    </div>
  {:else if authStore.initialized}
    <div class="no-providers">
      <span class="status-text">Aucun fournisseur d'authentification configuré</span>
    </div>
  {:else}
    <div class="loading">
      <span class="status-text">Chargement...</span>
    </div>
  {/if}
</div>

<style>
  .user-section {
    display: flex;
    align-items: center;
    gap: 8px;
    position: relative;
  }

  .login-buttons {
    display: flex;
    gap: 8px;
  }

  .login-btn {
    background: linear-gradient(135deg, #007acc, #005a9e);
    border: none;
    color: white;
    padding: 6px 12px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 12px;
    font-weight: 500;
    transition: all 0.2s ease;
  }

  .login-btn:hover:not(:disabled) {
    background: linear-gradient(135deg, #1177bb, #006bb3);
    transform: translateY(-1px);
  }

  .login-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none;
  }

  .user-btn {
    background: transparent;
    border: 1px solid #3e3e42;
    color: #cccccc;
    padding: 4px 8px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 12px;
    display: flex;
    align-items: center;
    gap: 6px;
    transition: all 0.2s ease;
  }

  .user-btn:hover {
    background: #3e3e42;
    border-color: #007acc;
  }

  .user-avatar {
    font-size: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 16px;
  }

  .user-avatar img {
    width: 16px;
    height: 16px;
    border-radius: 50%;
    object-fit: cover;
  }

  .username {
    font-weight: 500;
  }

  .dropdown-arrow {
    font-size: 8px;
    transition: transform 0.2s ease;
  }

  .dropdown-arrow.rotated {
    transform: rotate(180deg);
  }

  .user-menu {
    position: absolute;
    top: 100%;
    right: 0;
    background: #383838;
    border: 1px solid #3e3e42;
    border-radius: 6px;
    padding: 8px 0;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
    z-index: 1001;
    min-width: 200px;
    margin-top: 4px;
  }

  .user-info {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 16px;
  }

  .user-avatar-large {
    font-size: 24px;
    width: 32px;
    height: 32px;
    background: #007acc;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .user-avatar-large img {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    object-fit: cover;
  }

  .user-details {
    flex: 1;
  }

  .user-name {
    font-weight: 500;
    color: white;
    font-size: 14px;
  }

  .user-status {
    font-size: 11px;
    color: #4caf50;
    margin-top: 2px;
  }

  .menu-separator {
    border: none;
    border-top: 1px solid #3e3e42;
    margin: 8px 0;
  }

  .menu-item {
    width: 100%;
    background: transparent;
    border: none;
    color: #cccccc;
    padding: 8px 16px;
    text-align: left;
    cursor: pointer;
    font-size: 12px;
    display: flex;
    align-items: center;
    gap: 8px;
    transition: background 0.2s ease;
  }

  .menu-item:hover {
    background: #3e3e42;
  }

  .logout-item:hover {
    background: #dc3545;
    color: white;
  }

  .menu-icon {
    font-size: 14px;
    width: 16px;
    text-align: center;
  }

  .status-text {
    font-size: 12px;
    color: #cccccc;
  }

  .no-providers {
    padding: 6px 12px;
    background: #3e3e42;
    border-radius: 4px;
  }

  .loading {
    padding: 6px 12px;
  }
</style>
