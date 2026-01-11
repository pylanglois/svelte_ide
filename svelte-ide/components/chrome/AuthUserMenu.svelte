<script>
import { getAuthStore } from '../../stores/authStore.svelte.js'

const authStore = getAuthStore()

let userMenuOpen = $state(false)

function toggleUserMenu() {
  userMenuOpen = !userMenuOpen
}

function closeUserMenu() {
  userMenuOpen = false
}

async function handleLogout() {
  closeUserMenu()
  await authStore.logout()
}

function handleWindowClick(event) {
  if (!event.target.closest('.side-auth')) {
    closeUserMenu()
  }
}

function getUserDisplayName(user) {
  return user?.name || user?.email || user?.id || 'User'
}

function getUserInitial(user) {
  const label = getUserDisplayName(user)
  return label ? label.trim().slice(0, 1).toUpperCase() : 'U'
}
</script>

<svelte:window onclick={handleWindowClick} />

<div class="side-auth">
  {#if authStore.isAuthenticated && authStore.currentUser}
    <button
      class="side-user-button"
      onclick={toggleUserMenu}
      type="button"
      aria-haspopup="menu"
      aria-expanded={userMenuOpen}
      disabled={authStore.isLoading}
    >
      <span class="side-user-avatar">{getUserInitial(authStore.currentUser)}</span>
      <span class="side-user-name">{getUserDisplayName(authStore.currentUser)}</span>
      <span class="side-user-arrow" class:open={userMenuOpen}>v</span>
    </button>

    {#if userMenuOpen}
      <div class="side-user-menu" role="menu">
        <div class="side-user-info">
          <div class="side-user-avatar large">{getUserInitial(authStore.currentUser)}</div>
          <div class="side-user-details">
            <div class="side-user-name">{getUserDisplayName(authStore.currentUser)}</div>
            <div class="side-user-provider">{authStore.currentUser.provider || 'OAuth'}</div>
          </div>
        </div>
        <button class="side-menu-item" onclick={handleLogout} role="menuitem" type="button">
          Sign out
        </button>
      </div>
    {/if}
  {:else}
    <div class="side-auth-status">Not signed in</div>
  {/if}
</div>

<style>
.side-auth {
  display: flex;
  align-items: center;
  position: relative;
}

.side-user-button {
  background: transparent;
  border: 1px solid var(--border);
  color: inherit;
  padding: 4px 8px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  display: flex;
  align-items: center;
  gap: 6px;
}

.side-user-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.side-user-avatar {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--primary);
  color: white;
  font-size: 10px;
  font-weight: 600;
}

.side-user-avatar.large {
  width: 32px;
  height: 32px;
  font-size: 16px;
}

.side-user-name {
  font-weight: 500;
}

.side-user-arrow {
  font-size: 8px;
  transition: transform 0.2s ease;
}

.side-user-arrow.open {
  transform: rotate(180deg);
}

.side-user-menu {
  position: absolute;
  top: 100%;
  right: 0;
  background: var(--surface-raised);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 8px 0;
  box-shadow: var(--shadow-menu);
  z-index: 10;
  min-width: 200px;
  margin-top: 4px;
}

.side-user-info {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 16px;
}

.side-user-details {
  flex: 1;
}

.side-user-provider {
  font-size: 11px;
  color: var(--text-muted);
  margin-top: 2px;
}

.side-menu-item {
  width: 100%;
  background: transparent;
  border: none;
  color: inherit;
  padding: 8px 16px;
  text-align: left;
  cursor: pointer;
  font-size: 12px;
}

.side-menu-item:hover {
  background: var(--surface-hover);
}

.side-auth-status {
  font-size: 12px;
  color: var(--text-muted);
}

.side-user-button:hover {
  background: var(--surface-hover);
}
</style>
