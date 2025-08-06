<script>
  // import { authStore } from '../../stores/authStore.svelte.js'
  // import { ideStore } from '../../stores/ideStore.svelte.js'

  let selectedProvider = $state(null)
  let mockAvailableProviders = $state([])
  let isLoading = $state(false)
  let error = $state(null)

  async function handleLogin() {
    if (!selectedProvider) return
    
    isLoading = true
    
    // Mock login pour tester l'interface
    setTimeout(() => {
      isLoading = false
      alert(`Mock login avec ${selectedProvider}`)
    }, 1000)
  }

  function getProviderIcon(providerId) {
    switch (providerId) {
      case 'azure': return '🔷'
      case 'google': return '🟡'
      default: return '🔐'
    }
  }
</script>

<div class="auth-panel">
  <div class="auth-header">
    <h1>🔐 Authentification</h1>
    <p>Connectez-vous pour accéder à l'IDE</p>
  </div>

  {#if isLoading}
    <div class="loading">
      <div class="spinner"></div>
      <p>Connexion en cours...</p>
    </div>
  {:else if error}
    <div class="error">
      <p>❌ {error}</p>
      <button onclick={() => error = null}>Réessayer</button>
    </div>
  {:else if mockAvailableProviders.length === 0}
    <div class="no-providers">
      <p>⚠️ Aucun fournisseur d'authentification configuré</p>
      <p class="hint">Vérifiez vos variables d'environnement</p>
    </div>
  {:else}
    <div class="auth-form">
      <div class="provider-selection">
        <label for="provider">Fournisseur d'authentification :</label>
        <select id="provider" bind:value={selectedProvider}>
          {#each mockAvailableProviders as provider (provider.id)}
            <option value={provider.id}>
              {getProviderIcon(provider.id)} {provider.name}
            </option>
          {/each}
        </select>
      </div>

      <button 
        class="login-button"
        onclick={handleLogin}
        disabled={!selectedProvider}
      >
        Se connecter avec {selectedProvider ? mockAvailableProviders.find(p => p.id === selectedProvider)?.name : ''}
      </button>
    </div>
  {/if}

  <div class="auth-info">
    <p>🔒 Connexion sécurisée via OAuth 2.0</p>
    <p>📋 Vos données restent privées</p>
  </div>
</div>

<style>
  .auth-panel {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    padding: 2rem;
    background: linear-gradient(135deg, #1e1e1e 0%, #2d2d30 100%);
    color: #cccccc;
  }

  .auth-header {
    text-align: center;
    margin-bottom: 2rem;
  }

  .auth-header h1 {
    font-size: 2.5rem;
    margin-bottom: 0.5rem;
    color: #ffffff;
  }

  .auth-header p {
    font-size: 1.1rem;
    color: #b3b3b3;
  }

  .auth-form {
    background: #383838;
    padding: 2rem;
    border-radius: 12px;
    border: 1px solid #4a4a4a;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
    min-width: 400px;
    margin-bottom: 2rem;
  }

  .provider-selection {
    margin-bottom: 1.5rem;
  }

  .provider-selection label {
    display: block;
    margin-bottom: 0.5rem;
    font-weight: 500;
    color: #ffffff;
  }

  .provider-selection select {
    width: 100%;
    padding: 0.75rem;
    background: #2d2d30;
    border: 1px solid #4a4a4a;
    border-radius: 6px;
    color: #cccccc;
    font-size: 1rem;
  }

  .provider-selection select:focus {
    outline: none;
    border-color: #007acc;
    box-shadow: 0 0 0 2px rgba(0, 122, 204, 0.2);
  }

  .login-button {
    width: 100%;
    padding: 1rem;
    background: #007acc;
    border: none;
    border-radius: 6px;
    color: white;
    font-size: 1.1rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .login-button:hover:not(:disabled) {
    background: #005a9e;
    transform: translateY(-1px);
  }

  .login-button:disabled {
    background: #555555;
    cursor: not-allowed;
  }

  .loading {
    text-align: center;
    padding: 2rem;
  }

  .spinner {
    width: 40px;
    height: 40px;
    border: 4px solid #4a4a4a;
    border-top: 4px solid #007acc;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin: 0 auto 1rem;
  }

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }

  .error {
    background: #4a1a1a;
    border: 1px solid #8b2635;
    border-radius: 6px;
    padding: 1rem;
    margin-bottom: 1rem;
    text-align: center;
  }

  .error button {
    margin-top: 1rem;
    padding: 0.5rem 1rem;
    background: #d73a49;
    border: none;
    border-radius: 4px;
    color: white;
    cursor: pointer;
  }

  .no-providers {
    background: #4a3a1a;
    border: 1px solid #8b6914;
    border-radius: 6px;
    padding: 1rem;
    text-align: center;
  }

  .hint {
    font-size: 0.9rem;
    color: #b3b3b3;
    margin-top: 0.5rem;
  }

  .auth-info {
    text-align: center;
    color: #999999;
    font-size: 0.9rem;
  }

  .auth-info p {
    margin: 0.25rem 0;
  }
</style>
