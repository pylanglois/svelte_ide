<script>
let { error = null } = $props()
let message = $derived(error?.message || 'Boot error')
</script>

<div class="boot-error">
  <div class="boot-error-card">
    <h1>Startup error</h1>
    <p class="message">{message}</p>
    <p class="hint">Check VITE_APP_KEY, VITE_AUTH_PROVIDERS, and provider environment variables.</p>
  </div>
</div>

<style>
.boot-error {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  width: 100%;
  padding: 32px;
  background: #0f1115;
  color: #e5e7eb;
}

.boot-error-card {
  max-width: 480px;
  width: 100%;
  padding: 24px;
  border: 1px solid #374151;
  background: #151a21;
}

.message {
  margin-top: 12px;
  color: #fca5a5;
}

.hint {
  margin-top: 16px;
  color: #9ca3af;
}
</style>
