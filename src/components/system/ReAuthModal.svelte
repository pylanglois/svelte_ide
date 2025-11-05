<script>
  import { eventBus } from '@/core/EventBusService.svelte.js';
  import { getAuthStore } from '@/stores/authStore.svelte.js';

  const authStore = getAuthStore()

  let showModal = $state(false)
  let sessionExpiredData = $state(null)
  let isReauthenticating = $state(false)
  let reauthError = $state(null)

  // Écouter l'événement de session expirée
  $effect(() => {
    const unsubscribe = eventBus.subscribe('auth:session-expired', (data) => {
      sessionExpiredData = data
      showModal = true
      isReauthenticating = false
      reauthError = null
    })

    return () => unsubscribe()
  })

  async function handleReAuth(providerId) {
    isReauthenticating = true
    reauthError = null

    try {
      const result = await authStore.login(providerId)
      
      if (result.success) {
        showModal = false
        sessionExpiredData = null
      } else {
        reauthError = result.error || 'Échec de la reconnexion'
      }
    } catch (error) {
      reauthError = error.message || 'Erreur lors de la reconnexion'
    } finally {
      isReauthenticating = false
    }
  }

  function handleCancel() {
    showModal = false
    sessionExpiredData = null
  }
</script>

{#if showModal}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="reauth-modal-backdrop" onclick={handleCancel}>
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="reauth-modal" onclick={(e) => e.stopPropagation()}>
      <div class="reauth-modal-header">
        <h2>⏱️ Session Expirée</h2>
      </div>

      <div class="reauth-modal-body">
        <p>
          {sessionExpiredData?.message || 'Votre session a expiré. Veuillez vous reconnecter pour continuer.'}
        </p>

        {#if reauthError}
          <div class="reauth-error">
            ⚠️ {reauthError}
          </div>
        {/if}

        <div class="reauth-providers">
          <p><strong>Sélectionnez un fournisseur :</strong></p>
          {#each authStore.availableProviders as provider}
            <button
              class="reauth-provider-button"
              onclick={() => handleReAuth(provider.id)}
              disabled={isReauthenticating}
            >
              <span class="provider-icon">{provider.icon || '🔐'}</span>
              <span class="provider-name">{provider.name}</span>
            </button>
          {/each}
        </div>
      </div>

      <div class="reauth-modal-footer">
        <button 
          class="reauth-cancel-button" 
          onclick={handleCancel}
          disabled={isReauthenticating}
        >
          Annuler
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .reauth-modal-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(0, 0, 0, 0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
    backdrop-filter: blur(4px);
  }

  .reauth-modal {
    background: var(--vscode-editor-background);
    border: 1px solid var(--vscode-panel-border);
    border-radius: 6px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
    min-width: 400px;
    max-width: 500px;
    animation: slideIn 0.2s ease-out;
  }

  @keyframes slideIn {
    from {
      opacity: 0;
      transform: translateY(-20px) scale(0.95);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }

  .reauth-modal-header {
    padding: 16px 20px;
    border-bottom: 1px solid var(--vscode-panel-border);
  }

  .reauth-modal-header h2 {
    margin: 0;
    font-size: 18px;
    color: var(--vscode-foreground);
    font-weight: 600;
  }

  .reauth-modal-body {
    padding: 20px;
  }

  .reauth-modal-body p {
    margin: 0 0 16px 0;
    color: var(--vscode-foreground);
    line-height: 1.5;
  }

  .reauth-error {
    background: var(--vscode-inputValidation-errorBackground);
    border: 1px solid var(--vscode-inputValidation-errorBorder);
    color: var(--vscode-inputValidation-errorForeground);
    padding: 12px;
    border-radius: 4px;
    margin-bottom: 16px;
    font-size: 14px;
  }

  .reauth-providers {
    margin-top: 16px;
  }

  .reauth-providers p {
    margin-bottom: 12px;
    font-weight: 500;
  }

  .reauth-provider-button {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    padding: 12px 16px;
    margin-bottom: 8px;
    background: var(--vscode-button-background);
    color: var(--vscode-button-foreground);
    border: 1px solid var(--vscode-button-border);
    border-radius: 4px;
    cursor: pointer;
    font-size: 14px;
    transition: all 0.15s ease;
  }

  .reauth-provider-button:hover:not(:disabled) {
    background: var(--vscode-button-hoverBackground);
    transform: translateY(-1px);
  }

  .reauth-provider-button:active:not(:disabled) {
    transform: translateY(0);
  }

  .reauth-provider-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .provider-icon {
    font-size: 20px;
  }

  .provider-name {
    flex: 1;
    text-align: left;
  }

  .reauth-modal-footer {
    padding: 12px 20px;
    border-top: 1px solid var(--vscode-panel-border);
    display: flex;
    justify-content: flex-end;
  }

  .reauth-cancel-button {
    padding: 8px 16px;
    background: var(--vscode-button-secondaryBackground);
    color: var(--vscode-button-secondaryForeground);
    border: 1px solid var(--vscode-button-border);
    border-radius: 4px;
    cursor: pointer;
    font-size: 13px;
  }

  .reauth-cancel-button:hover:not(:disabled) {
    background: var(--vscode-button-secondaryHoverBackground);
  }

  .reauth-cancel-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>
