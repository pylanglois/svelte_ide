<script>
  import { getAuthStore } from '@/stores/authStore.svelte.js'
  import { ideStore } from '@/stores/ideStore.svelte.js'

  const authStore = getAuthStore()

  $effect(() => {
    authStore.initialize()
  })

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

  function getProviderIcon(providerId) {
    switch (providerId) {
      case 'azure': return 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/fa/Microsoft_Azure.svg/150px-Microsoft_Azure.svg.png'
      case 'google': return 'https://developers.google.com/identity/images/g-logo.png'
      case 'mock': return '👨‍💻'
      default: return '🔐'
    }
  }

  function isImageLogo(providerId) {
    return ['azure', 'google'].includes(providerId)
  }
</script>

<div class="welcome-screen">
  <div class="welcome-content">
    <h2>Connectez-vous pour commencer</h2>
    <div class="provider-buttons">
      {#each authStore.availableProviders as provider}
        <button 
          class="provider-btn" 
          onclick={() => handleLogin(provider.id)} 
          disabled={authStore.isLoading}
        >
          <span class="provider-icon">
            {#if isImageLogo(provider.id)}
              <img src={getProviderIcon(provider.id)} alt="{provider.name} logo" />
            {:else}
              {getProviderIcon(provider.id)}
            {/if}
          </span>
          <span class="provider-name">
            {#if authStore.isLoading}
              Connexion...
            {:else}
              {provider.name}
            {/if}
          </span>
        </button>
      {/each}
    </div>

    {#if authStore.initialized && authStore.availableProviders.length === 0}
      <div class="config-notice">
        <p>⚠️ Configuration requise</p>
        <code>VITE_AUTH_PROVIDERS=azure,google</code>
      </div>
    {/if}

    {#if authStore.error}
      <div class="error-notice">
        <p>❌ {authStore.error}</p>
      </div>
    {/if}

    {#if !authStore.initialized}
      <p>Chargement...</p>
    {/if}
  </div>
</div>

<style>
  .welcome-screen {
    flex: 1;
    background: #1e1e1e;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
  }

  .welcome-content {
    text-align: center;
    max-width: 300px;
  }

  h2 {
    font-size: 18px;
    color: #ffffff;
    margin: 0 0 24px 0;
    font-weight: 400;
  }

  p {
    font-size: 14px;
    color: #cccccc;
    margin: 16px 0;
  }

  .provider-buttons {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .provider-btn {
    background: #2d2d30;
    border: 1px solid #3e3e42;
    color: #ffffff;
    padding: 16px;
    cursor: pointer;
    font-size: 14px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    transition: all 0.2s ease;
    min-height: 80px;
    justify-content: center;
  }

  .provider-btn:hover:not(:disabled) {
    background: #3e3e42;
    border-color: #007acc;
  }

  .provider-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .provider-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
  }

  .provider-icon img {
    width: 24px;
    height: 24px;
    object-fit: contain;
  }

  .provider-icon:not(:has(img)) {
    font-size: 24px;
  }

  .provider-name {
    font-weight: 500;
    font-size: 14px;
  }

  .config-notice {
    padding: 16px;
    background: #2d2d30;
    border: 1px solid #dc3545;
    margin-top: 24px;
  }

  .config-notice p {
    color: #dc3545;
    margin: 0 0 8px 0;
    font-size: 14px;
  }

  .config-notice code {
    background: #000000;
    color: #4caf50;
    padding: 4px 8px;
    font-family: monospace;
    font-size: 12px;
  }

  .error-notice {
    margin-top: 24px;
    padding: 16px;
    background: #4a1a1a;
    border: 1px solid #8b2635;
    color: #ffb3b3;
    font-size: 14px;
  }
</style>
