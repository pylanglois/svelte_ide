<script>
  import { ideStore } from '../../stores/ideStore.svelte.js'
  import WelcomeScreen from './WelcomeScreen.svelte'

  let draggedTab = $state(null)
  let dragOverTab = $state(null)

  function selectTab(tabId) {
    ideStore.setActiveTab(tabId)
  }

  function closeTab(e, tabId) {
    e.stopPropagation()
    ideStore.closeTab(tabId)
  }

  function handleDragStart(e, tab) {
    draggedTab = tab
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/html', '')
    
    // Empêcher la sélection de texte
    document.body.style.userSelect = 'none'
  }

  function handleDragOver(e, tab) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    dragOverTab = tab
  }

  function handleDragLeave(e, tab) {
    if (dragOverTab === tab) {
      dragOverTab = null
    }
  }

  function handleDrop(e, targetTab) {
    e.preventDefault()
    
    if (draggedTab && targetTab && draggedTab.id !== targetTab.id) {
      const tabs = [...ideStore.tabs]
      const draggedIndex = tabs.findIndex(t => t.id === draggedTab.id)
      const targetIndex = tabs.findIndex(t => t.id === targetTab.id)
      
      // Retirer l'onglet de sa position actuelle
      const [removed] = tabs.splice(draggedIndex, 1)
      // L'insérer à la nouvelle position
      tabs.splice(targetIndex, 0, removed)
      
      // Mettre à jour le store
      ideStore.reorderTabs(tabs)
    }
    
    // Nettoyer
    draggedTab = null
    dragOverTab = null
    document.body.style.userSelect = ''
  }

  function handleDragEnd() {
    draggedTab = null
    dragOverTab = null
    document.body.style.userSelect = ''
  }

  let activeTabData = $state(null)

  // Mise à jour réactive avec $effect
  $effect(() => {
    activeTabData = ideStore.tabs.find(tab => tab.id === ideStore.activeTab) || null
  })
</script>

<div class="main-view">
  {#if !ideStore.user}
    <WelcomeScreen />
  {:else if ideStore.tabs.length > 0}
    <div class="tab-bar">
      {#each ideStore.tabs as tab (tab.id)}
        <div 
          class="tab"
          class:active={tab.id === ideStore.activeTab}
          class:dragging={draggedTab?.id === tab.id}
          class:drag-over={dragOverTab?.id === tab.id}
          onclick={() => selectTab(tab.id)}
          ondragstart={(e) => handleDragStart(e, tab)}
          ondragover={(e) => handleDragOver(e, tab)}
          ondragleave={(e) => handleDragLeave(e, tab)}
          ondrop={(e) => handleDrop(e, tab)}
          ondragend={handleDragEnd}
          draggable="true"
          role="tab"
          tabindex="0"
        >
          <span class="tab-title">
            {#if tab.icon}
              <span class="tab-icon">{tab.icon}</span>
            {/if}
            {tab.title}
            {#if tab.modified}
              <span class="modified-indicator">●</span>
            {/if}
          </span>
          {#if tab.closable}
            <button 
              class="close-tab-btn"
              onclick={(e) => closeTab(e, tab.id)}
            >
              ×
            </button>
          {/if}
        </div>
      {/each}
    </div>
    
    <div class="tab-content">
      {#if activeTabData && activeTabData.component}
        {@const Component = activeTabData.component}
        {#if activeTabData.fileContent}
          <Component content={activeTabData.fileContent} />
        {:else}
          <Component />
        {/if}
      {:else if activeTabData}
        <div class="placeholder">
          <h3>{activeTabData.title}</h3>
          <p>Contenu à implémenter</p>
        </div>
      {/if}
    </div>
  {:else}
    <div class="empty-state">
      <div class="empty-content">
        <h2>Bienvenue</h2>
        <p>Sélectionner un outils pour commencer</p>
      </div>
    </div>
  {/if}
</div>

<style>
  .main-view {
    flex: 1;
    background: #1e1e1e;
    display: flex;
    flex-direction: column;
    min-width: 0;
    overflow: hidden;
  }

  .tab-bar {
    background: #2d2d30;
    border-bottom: 1px solid #3e3e42;
    display: flex;
    overflow-x: hidden;
    scrollbar-width: none;
    min-width: 0;
    flex-shrink: 1;
  }

  .tab-bar::-webkit-scrollbar {
    display: none;
  }

  .tab {
    display: flex;
    align-items: center;
    padding: 8px 4px;
    background: #2d2d30;
    border: none;
    border-right: 1px solid #3e3e42;
    color: #cccccc;
    cursor: pointer;
    white-space: nowrap;
    position: relative;
    user-select: none;
    transition: all 0.2s ease;
    min-width: 0;
    flex-shrink: 10;
    overflow: hidden;
    max-width: none;
  }

  .tab:hover {
    background: #3e3e42;
  }

  .tab.active {
    background: #1e1e1e;
    border-bottom: 2px solid #007acc;
    color: white;
  }

  .tab.dragging {
    opacity: 0.5;
    transform: rotate(3deg);
  }

  .tab.drag-over {
    background: #007acc;
    transform: scale(1.05);
  }

  .tab-title {
    flex: 1;
    font-size: 13px;
    overflow: hidden;
    text-overflow: ellipsis;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .tab-icon {
    font-size: 12px;
    flex-shrink: 0;
    opacity: 0.8;
  }

  .modified-indicator {
    color: #f0c674;
    margin-left: 4px;
  }

  .close-tab-btn {
    background: transparent;
    border: none;
    color: #cccccc;
    font-size: 14px;
    cursor: pointer;
    margin-left: 4px;
    padding: 0;
    width: 16px;
    height: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 2px;
    flex-shrink: 0;
    min-width: 0;
  }

  .close-tab-btn:hover {
    background: #3e3e42;
    color: white;
  }

  .tab-content {
    flex: 1;
    overflow: auto;
    background: #1e1e1e;
  }

  .placeholder {
    padding: 20px;
    color: #cccccc;
    text-align: center;
  }

  .placeholder h3 {
    font-size: 16px;
    margin-bottom: 8px;
    color: white;
  }

  .empty-state {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #1e1e1e;
  }

  .empty-content {
    text-align: center;
    color: #cccccc;
  }

  .empty-content h2 {
    font-size: 20px;
    font-weight: 300;
    margin-bottom: 12px;
    color: white;
  }

  .empty-content p {
    font-size: 14px;
    opacity: 0.7;
  }
</style>
