<script>
import { getAuthStore } from '../../stores/authStore.svelte.js'

const authStore = getAuthStore()

const handleLogin = (providerId) => {
  void authStore.login(providerId)
}
</script>

<div class="login-screen">
  <div class="login-card">
    <h1>Sign in</h1>

    {#if authStore.sessionStatus?.type === 'expired'}
      <p class="session-expired">{authStore.sessionStatus.message}</p>
    {/if}

    {#if authStore.error}
      <p class="error">{authStore.error}</p>
    {/if}

    {#if !authStore.initialized}
      <p class="loading">Loading providers...</p>
    {/if}

    <div class="provider-list">
      {#each authStore.availableProviders as provider}
        <button class="provider-button" onclick={() => handleLogin(provider.id)} disabled={authStore.isLoading}>
          {authStore.isLoading ? 'Signing in...' : provider.name}
        </button>
      {/each}
    </div>
  </div>
</div>

<style>
.login-screen {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  width: 100%;
  padding: 32px;
  background: #0f1115;
  color: #e5e7eb;
}

.login-card {
  max-width: 360px;
  width: 100%;
  padding: 24px;
  border: 1px solid #374151;
  background: #151a21;
}

.provider-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 16px;
}

.provider-button {
  padding: 12px 16px;
  border: 1px solid #374151;
  background: #111827;
  color: inherit;
  cursor: pointer;
}

.provider-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.loading {
  margin-top: 12px;
  color: #9ca3af;
}

.error,
.session-expired {
  margin-top: 12px;
  color: #fca5a5;
}
</style>
