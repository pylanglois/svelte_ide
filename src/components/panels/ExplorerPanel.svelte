<script>
  import ExplorerWrapper from '@tools/explorer/ExplorerWrapper.svelte'
  import { ideStore } from '@/stores/ideStore.svelte.js'
  
  let { panelId = 'explorer-panel', toolId = null } = $props()
</script>

<div class="explorer-panel-wrapper">
  <div class="panel-header">
    <span class="panel-title">📁 Explorateur</span>
    <button 
      class="panel-close" 
      onclick={() => ideStore.legacyAdapter.panelsManager.deactivatePanel(panelId)}
      title="Fermer"
    >
      ✕
    </button>
  </div>
  
  <div class="panel-content">
    <ExplorerWrapper {toolId} />
  </div>
</div>

<style>
  .explorer-panel-wrapper {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--panel-bg, #1e1e1e);
    border: 1px solid var(--panel-border, #404040);
  }
  
  .panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 12px;
    background: var(--panel-header-bg, #2d2d30);
    border-bottom: 1px solid var(--panel-border, #404040);
    font-size: 12px;
    color: var(--text-color, #cccccc);
  }
  
  .panel-title {
    font-weight: 500;
  }
  
  .panel-close {
    background: none;
    border: none;
    color: var(--text-color, #cccccc);
    cursor: pointer;
    padding: 2px 6px;
    border-radius: 3px;
    font-size: 11px;
  }
  
  .panel-close:hover {
    background: var(--button-hover-bg, #404040);
  }
  
  .panel-content {
    flex: 1;
    overflow: hidden;
  }
</style>
