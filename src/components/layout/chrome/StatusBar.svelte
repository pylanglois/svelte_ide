<script>
  import { ideStore } from '@/stores/ideStore.svelte.js'

  let currentTime = $state(new Date().toLocaleTimeString())

  // Utiliser $effect une seule fois pour l'horloge
  $effect(() => {
    const interval = setInterval(() => {
      currentTime = new Date().toLocaleTimeString()
    }, 1000)

    return () => clearInterval(interval)
  })
</script>

<div class="status-bar">
  <div class="status-left">
    <span class="status-message">{ideStore.statusMessage || 'Prêt'}</span>
  </div>
  
  <div class="status-center">
    {#if ideStore.activeTab}
      <span class="active-file">Fichier actif: {ideStore.activeTab}</span>
    {/if}
  </div>
  
  <div class="status-right">
    <span class="time">{currentTime}</span>
  </div>
</div>

<style>
  .status-bar {
    height: 24px;
    background: #007acc;
    color: white;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 12px;
    font-size: 12px;
    position: relative;
  }

  .status-left, .status-center, .status-right {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .status-center {
    flex: 1;
    justify-content: center;
  }

  .status-message {
    color: white;
  }

  .active-file {
    color: rgba(255, 255, 255, 0.9);
    font-style: italic;
  }

  .time {
    color: rgba(255, 255, 255, 0.8);
    font-family: 'Courier New', monospace;
  }
</style>
