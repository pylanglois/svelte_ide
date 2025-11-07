<script>
  import { getAuthStore } from '@/stores/authStore.svelte.js';
  import { ideStore } from '@/stores/ideStore.svelte.js';

  const authStore = getAuthStore()
  
  let userMenu = $state(false)
  let wasAuthenticated = $state(false)
  let menuButton = $state(null)
  const menuId = 'auth-user-menu'
  const buttonId = 'auth-user-menu-button'

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

  $effect(() => {
    if (userMenu) {
      const menu = document.getElementById(menuId)
      const focusTarget = menu?.querySelector('[role="menuitem"]')
      focusTarget?.focus()
    } else if (menuButton) {
      if (document.activeElement && document.activeElement.closest('.user-menu')) {
        menuButton.focus()
      }
    }
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

  function getUserAvatarImage(user) {
    if (user?.avatar && (user.avatar.startsWith('http') || user.avatar.startsWith('blob:'))) {
      return user.avatar
    }
    return null
  }
  
  function hasAvatar(user) {
    return getUserAvatarImage(user) !== null
  }

  function getUserDisplayName(user) {
    const displayName = user?.name || user?.email || 'Utilisateur'
    return displayName
  }
</script>

<svelte:window onclick={handleClickOutside} />

<div class="user-section">
  {#if authStore.isAuthenticated && authStore.currentUser}
    <button
      class="user-btn"
      onclick={toggleUserMenu}
      type="button"
      aria-haspopup="menu"
      aria-expanded={userMenu}
      aria-controls={menuId}
      id={buttonId}
      bind:this={menuButton}
    >
      <span class="user-avatar" class:has-image={hasAvatar(authStore.currentUser)}>
        {#if getUserAvatarImage(authStore.currentUser)}
          <img src={getUserAvatarImage(authStore.currentUser)} alt={`[${getUserDisplayName(authStore.currentUser)[0]}]`} />
        {/if}
      </span>
      <span class="username">{getUserDisplayName(authStore.currentUser)}</span>
      <span class="dropdown-arrow" class:rotated={userMenu} aria-hidden="true">▼</span>
    </button>
    
    {#if userMenu}
      <div class="user-menu" role="menu" id={menuId} aria-labelledby={buttonId}>
        <div class="user-info">
          <div class="user-avatar-large" class:has-image={hasAvatar(authStore.currentUser)}>
            {#if getUserAvatarImage(authStore.currentUser)}
              <img src={getUserAvatarImage(authStore.currentUser)} alt={`Avatar de ${getUserDisplayName(authStore.currentUser)}`} />
            {/if}
          </div>
          <div class="user-details">
            <div class="user-name">{getUserDisplayName(authStore.currentUser)}</div>
            <div class="user-status">Connecté via {authStore.currentUser.provider || 'OAuth'}</div>
          </div>
        </div>
        <hr class="menu-separator">
        <button class="menu-item logout-item" onclick={handleLogout} role="menuitem" type="button">
          <span class="menu-icon">🚪</span>
          Se déconnecter
        </button>
      </div>
    {/if}
  {:else if authStore.initialized && authStore.availableProviders.length > 0}
    <!-- Interface de connexion déplacée vers WelcomeScreen -->
    <div class="auth-status">
      <span class="status-text">Non connecté</span>
    </div>
  {:else if authStore.initialized}
    <div class="no-providers">
      <span class="status-text">Configuration requise</span>
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

  .auth-status {
    display: flex;
    align-items: center;
    padding: 4px 8px;
    background: transparent;
    border: 1px solid #3e3e42;
    border-radius: 4px;
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
    display: flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 16px;
  }
  
  /* Masquer complètement l'avatar si pas d'image */
  .user-avatar:not(.has-image) {
    display: none;
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
    width: 32px;
    height: 32px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #007acc;
  }
  
  /* Masquer complètement l'avatar large si pas d'image */
  .user-avatar-large:not(.has-image) {
    display: none;
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
