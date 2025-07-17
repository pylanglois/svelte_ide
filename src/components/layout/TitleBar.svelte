<script>
  import { ideStore } from '../../stores/ideStore.svelte.js'

  let { user } = $props()
  let userMenu = $state(false)

  function toggleUserMenu() {
    userMenu = !userMenu
  }

  async function handleOAuthLogin() {
    // Mock OAuth flow - connecter un utilisateur démo
    const demoUser = {
      username: 'demo',
      email: 'demo@example.com',
      avatar: '👤',
      id: 'demo-user-id'
    }
    
    ideStore.login(demoUser)
    ideStore.addLog(`User ${demoUser.username} logged in via FakeOAuth`, 'info')
    ideStore.addNotification(
      'Connexion réussie',
      `Bienvenue ${demoUser.username} !`,
      'success',
      'Authentification'
    )
  }

  function handleLogout() {
    ideStore.addLog(`User ${ideStore.user?.username} logged out`, 'info')
    ideStore.addNotification(
      'Déconnexion',
      'Vous avez été déconnecté avec succès',
      'info',
      'Authentification'
    )
    ideStore.logout()
    userMenu = false
  }

  function handleClickOutside(e) {
    if (!e.target.closest('.user-section')) {
      userMenu = false
    }
  }
</script>

<div class="title-bar" onclick={handleClickOutside}>
  <div class="title">
    <h1>IDE Svelte</h1>
  </div>
  
  <div class="user-section">
    {#if ideStore.user}
      <button class="user-btn" onclick={toggleUserMenu}>
        <span class="user-avatar">👤</span>
        <span class="username">{ideStore.user.username}</span>
        <span class="dropdown-arrow" class:rotated={userMenu}>▼</span>
      </button>
      
      {#if userMenu}
        <div class="user-menu">
          <div class="user-info">
            <div class="user-avatar-large">👤</div>
            <div class="user-details">
              <div class="user-name">{ideStore.user.username}</div>
              <div class="user-status">Connecté</div>
            </div>
          </div>
          <hr class="menu-separator">
          <button class="menu-item logout-item" onclick={handleLogout}>
            <span class="menu-icon">🚪</span>
            Se déconnecter
          </button>
        </div>
      {/if}
    {:else}
      <button class="login-btn" onclick={handleOAuthLogin}>
        Connexion
      </button>
    {/if}
  </div>
</div>

<style>
  .title-bar {
    height: 32px;
    background: #2d2d30;
    border-bottom: 1px solid #3e3e42;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 16px;
    color: #cccccc;
    font-size: 13px;
    position: relative;
    z-index: 1000;
  }

  .title h1 {
    font-size: 13px;
    font-weight: 400;
    margin: 0;
  }

  .user-section {
    display: flex;
    align-items: center;
    gap: 8px;
    position: relative;
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

  .login-btn:hover {
    background: linear-gradient(135deg, #1177bb, #006bb3);
    transform: translateY(-1px);
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
</style>
