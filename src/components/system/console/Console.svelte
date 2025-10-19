<script>
  import { ideStore } from '@/stores/ideStore.svelte.js'
  let { panelId } = $props()

  function selectTab(tabId) {
    ideStore.setActiveConsoleTab(tabId)
  }

  function closeTab(e, tabId) {
    e.stopPropagation()
    ideStore.closeConsoleTab(tabId)
  }

  function clearTab(tabId) {
    ideStore.clearConsoleTab(tabId)
  }

  function getLogClass(type) {
    switch (type) {
      case 'error': return 'log-error'
      case 'warning': return 'log-warning'
      case 'info': return 'log-info'
      default: return 'log-default'
    }
  }

  function focusPanel() {
    const manager = ideStore.panelsManager
    if (!manager || !panelId) return
    manager.focusPanel(panelId)
  }

  function clearPanelFocus() {
    const manager = ideStore.panelsManager
    if (!manager) return
    manager.clearFocus()
  }

  function handleTabKeydown(e, tabId) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      selectTab(tabId)
    }
  }


  let activeConsoleTabData = $state(null)

  $effect(() => {
    if (ideStore.consoleTabs && ideStore.activeConsoleTab) {
      activeConsoleTabData = ideStore.consoleTabs.find(tab => tab.id === ideStore.activeConsoleTab)
    } else {
      activeConsoleTabData = null
    }
  })
</script>

<div 
    class="console-panel" 
    tabindex="-1"
    onfocus={focusPanel}
    onblur={clearPanelFocus}
    onfocusin={focusPanel}
  >
    <div class="console-header">
      <h3>Console</h3>
      
      {#if ideStore.consoleTabs.length > 0}
        <div class="console-tab-bar" role="tablist" aria-label="Onglets de console">
          {#each ideStore.consoleTabs as tab (tab.id)}
            <div 
              class="console-tab"
              class:active={tab.id === ideStore.activeConsoleTab}
              onclick={() => selectTab(tab.id)}
              role="tab"
              tabindex="0"
              onkeydown={(e) => handleTabKeydown(e, tab.id)}
              aria-selected={tab.id === ideStore.activeConsoleTab}
              id={`console-tab-${tab.id}`}
              aria-controls="console-tabpanel"
            >
              <span class="tab-title">{tab.title}</span>
              <div class="tab-actions">
                <button 
                  class="clear-tab-btn"
                  onclick={() => clearTab(tab.id)}
                  title="Nettoyer l'onglet"
                  type="button"
                >
                  🧹
                </button>
                <button 
                  class="close-tab-btn"
                  onclick={(e) => closeTab(e, tab.id)}
                  title="Fermer l'onglet"
                  type="button"
                >
                  ×
                </button>
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </div>
      
    {#if ideStore.consoleTabs.length > 0}
      <div
        class="console-content"
        role="tabpanel"
        id="console-tabpanel"
        aria-labelledby={ideStore.activeConsoleTab ? `console-tab-${ideStore.activeConsoleTab}` : undefined}
      >
        {#if ideStore.activeConsoleTab}
          {@const currentTab = ideStore.consoleTabs.find(tab => tab.id === ideStore.activeConsoleTab)}
          {#if currentTab && currentTab.logs && currentTab.logs.length > 0}
            {#each currentTab.logs as log (log.id)}
              <div class="log-entry {getLogClass(log.type)}">
                <span class="log-time">
                  {log.timestamp.toLocaleTimeString()}
                </span>
                <span class="log-message">{log.message}</span>
              </div>
            {/each}
          {:else}
            <div class="empty-console">
              <p>Aucun message dans cet onglet</p>
            </div>
          {/if}
        {:else}
          <div class="empty-console">
            <p>Aucun onglet actif</p>
          </div>
        {/if}
      </div>
    {:else}
      <div class="empty-console">
        <p>Aucun onglet de console</p>
      </div>
    {/if}
  </div>

<style>
  .console-panel {
    background: #1e1e1e;
    display: flex;
    flex-direction: column;
    position: relative;
    outline: none;
    height: 100%;
  }

  .console-header {
    height: 32px;
    background: #2d2d30;
    border-bottom: 1px solid #3e3e42;
    display: flex;
    align-items: center;
    padding: 0 12px;
    color: #cccccc;
    gap: 12px;
    flex-shrink: 0;
  }

  .console-header h3 {
    font-size: 13px;
    font-weight: 400;
    margin: 0;
    flex-shrink: 0;
  }

  .console-tab-bar {
    display: flex;
    flex: 1;
    overflow-x: auto;
    scrollbar-width: none;
    gap: 0;
  }

  .console-tab-bar::-webkit-scrollbar {
    display: none;
  }

  .console-tab {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 4px 8px;
    background: transparent;
    border: 1px solid #3e3e42;
    border-radius: 3px;
    color: #cccccc;
    cursor: pointer;
    min-width: 100px;
    max-width: 150px;
    white-space: nowrap;
    position: relative;
    margin-right: 4px;
    height: 22px;
  }

  .console-tab:hover {
    background: #3e3e42;
  }

  .console-tab.active {
    background: #007acc;
    border-color: #007acc;
    color: white;
  }

  .tab-title {
    flex: 1;
    font-size: 12px;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .tab-actions {
    display: flex;
    gap: 2px;
    margin-left: 4px;
  }

  .clear-tab-btn, .close-tab-btn {
    background: transparent;
    border: none;
    color: #cccccc;
    font-size: 10px;
    cursor: pointer;
    padding: 1px 3px;
    border-radius: 2px;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 16px;
  }

  .clear-tab-btn:hover, .close-tab-btn:hover {
    background: rgba(255, 255, 255, 0.1);
    color: white;
  }

  .console-content {
    flex: 1;
    overflow-y: auto;
    padding: 8px;
    font-family: 'Courier New', monospace;
    font-size: 12px;
    line-height: 1.4;
    user-select: text;
  }

  .log-entry {
    display: flex;
    margin-bottom: 2px;
    padding: 2px 0;
  }

  .log-time {
    color: #858585;
    margin-right: 8px;
    min-width: 80px;
  }

  .log-message {
    flex: 1;
    word-wrap: break-word;
  }

  .log-info {
    color: #cccccc;
  }

  .log-error {
    color: #f48771;
  }

  .log-warning {
    color: #dcdcaa;
  }

  .log-default {
    color: #cccccc;
  }

  .empty-console {
    text-align: center;
    color: #858585;
    margin-top: 20px;
  }

  .empty-console p {
    font-size: 13px;
    font-style: italic;
  }
</style>
