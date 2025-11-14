<script>
  import { createLogger } from '@/lib/logger.js'

  const props = $props()
  const className = $derived(props.className ?? '')
  const usageLogger = createLogger('components/indexeddb-usage')

  let storageInfo = $state({
    quota: null,
    usage: null,
    percentage: null,
    available: null
  })

  let error = $state(null)

  function formatBytes(bytes) {
    if (bytes === null || bytes === undefined) return 'N/A'
    if (bytes === 0) return '0 B'

    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))

    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
  }

  function getUsageColor(percentage) {
    if (percentage === null) return '#888'
    if (percentage < 80) return '#6b7280' // gris pâle discret
    if (percentage < 90) return '#d97706' // orange foncé subtil
    return '#b91c1c' // rouge foncé discret
  }

  async function updateStorageInfo() {
    try {
      if (!navigator.storage || !navigator.storage.estimate) {
        error = 'API non supportée'
        return
      }

      const estimate = await navigator.storage.estimate()

      const quota = estimate.quota || null
      const usage = estimate.usage || 0
      const percentage = quota ? Math.round((usage / quota) * 100) : null
      const available = quota ? quota - usage : null

      storageInfo = {
        quota,
        usage,
        percentage,
        available
      }

      error = null
    } catch (err) {
      usageLogger.warn('Failed to get storage estimate', err)
      error = 'Erreur'
      storageInfo = {
        quota: null,
        usage: null,
        percentage: null,
        available: null
      }
    }
  }

  // Mise à jour périodique toutes les 30 secondes
  $effect(() => {
    updateStorageInfo()

    const interval = setInterval(() => {
      updateStorageInfo()
    }, 30000) // 30 secondes

    return () => clearInterval(interval)
  })

  if (import.meta.env.DEV) {
    $effect(() => {
      usageLogger.debug('storageInfo snapshot', storageInfo)
    })
  }
</script>

<span class={`status-indexeddb-usage ${className}`}>
  {#if error}
    <span class="usage-error">🖬 {error}</span>
  {:else}
    <div class="usage-container">
      <span class="usage-icon">🖬</span>
      {#if storageInfo.percentage !== null}
        <div class="usage-bar-container">
          <div 
            class="usage-bar" 
            style="width: {storageInfo.percentage}%; background-color: {getUsageColor(storageInfo.percentage)}"
          ></div>
          <span class="usage-text">
            {formatBytes(storageInfo.usage)} / {formatBytes(storageInfo.quota)}
          </span>
        </div>
      {:else}
        <span class="usage-unlimited">Illimité</span>
      {/if}
    </div>
  {/if}
</span>

<style>
  .status-indexeddb-usage {
    color: rgba(255, 255, 255, 0.6);
    font-family: 'Courier New', monospace;
    font-size: 11px;
  }

  .usage-container {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .usage-icon {
    font-size: 12px;
    line-height: 1;
    color: rgba(255, 255, 255, 0.8);
  }

  .usage-bar-container {
    width: 120px;
    height: 18px;
    background: rgba(0, 0, 0, 0.3);
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 2px;
    overflow: hidden;
    position: relative;
  }

  .usage-bar {
    height: 100%;
    transition: width 0.5s ease-out, background-color 0.3s ease;
    position: absolute;
    top: 0;
    left: 0;
    opacity: 0.8;
  }

  .usage-text {
    position: relative;
    z-index: 1;
    color: rgba(255, 255, 255, 0.75);
    font-size: 9px;
    font-weight: 400;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    width: 100%;
    white-space: nowrap;
  }

  .usage-details {
    color: rgba(255, 255, 255, 0.7);
    font-size: 10px;
    white-space: nowrap;
  }

  .usage-unlimited {
    color: rgba(255, 255, 255, 0.7);
  }

  .usage-error {
    color: #dc3545;
    font-style: italic;
  }
</style>
