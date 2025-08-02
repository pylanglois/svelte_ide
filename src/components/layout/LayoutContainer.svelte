<script>
  import { ideStore } from '@/stores/ideStore.svelte.js'
  import { contextMenuService } from '@/core/ContextMenuService.svelte.js'
  import { layoutService } from '@/core/LayoutService.svelte.js'
  import ResizeHandle from '@/components/layout/ResizeHandle.svelte'
  import LayoutContainer from './LayoutContainer.svelte'

  let { layoutNode } = $props()

  let draggedTab = $state(null)
  let dragOverTab = $state(null)

  function selectTab(tabId) {
    ideStore.setActiveTab(tabId)
  }

  function closeTab(e, tabId) {
    e.stopPropagation()
    ideStore.closeTab(tabId)
  }

  function closeOtherTabs(currentTabId) {
    const tabsToClose = layoutNode.tabs.filter(tab => tab.id !== currentTabId && tab.closable)
    tabsToClose.forEach(tab => ideStore.closeTab(tab.id))
  }

  function closeAllTabs() {
    const closableTabs = layoutNode.tabs.filter(tab => tab.closable)
    closableTabs.forEach(tab => ideStore.closeTab(tab.id))
  }

  function handleTabContextMenu(e, tab) {
    e.preventDefault()
    
    const menuItems = [
      {
        id: 'close-tab',
        label: 'Fermer l\'onglet',
        icon: '✕',
        action: () => {
          if (tab.closable) {
            ideStore.closeTab(tab.id)
          }
        },
        disabled: !tab.closable
      },
      {
        id: 'separator1',
        separator: true
      },
      {
        id: 'close-other-tabs',
        label: 'Fermer les autres onglets',
        icon: '📄',
        action: () => closeOtherTabs(tab.id),
        disabled: layoutNode.tabs.filter(t => t.id !== tab.id && t.closable).length === 0
      },
      {
        id: 'close-all-tabs',
        label: 'Fermer tous les onglets',
        icon: '🗂️',
        action: () => closeAllTabs(),
        disabled: layoutNode.tabs.filter(t => t.closable).length === 0
      },
      {
        id: 'separator2',
        separator: true
      },
      {
        id: 'split-right',
        label: 'Diviser à droite',
        icon: '⊞',
        action: () => {
          layoutService.splitHorizontal(layoutNode.id)
        }
      },
      {
        id: 'split-bottom',
        label: 'Diviser en bas',
        icon: '⊟',
        action: () => {
          layoutService.splitVertical(layoutNode.id)
        }
      }
    ]

    contextMenuService.show(e.clientX, e.clientY, tab, menuItems)
  }

  function handleDragStart(e, tab) {
    draggedTab = tab
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/html', '')
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
      const tabs = [...layoutNode.tabs]
      const draggedIndex = tabs.findIndex(t => t.id === draggedTab.id)
      const targetIndex = tabs.findIndex(t => t.id === targetTab.id)
      
      const [removed] = tabs.splice(draggedIndex, 1)
      tabs.splice(targetIndex, 0, removed)
      
      ideStore.reorderTabs(tabs)
    }
    
    draggedTab = null
    dragOverTab = null
    document.body.style.userSelect = ''
  }

  function handleDragEnd() {
    draggedTab = null
    dragOverTab = null
    document.body.style.userSelect = ''
  }

  // Logique de redimensionnement simplifiée et corrigée
  function createResizeHandler(splitIndex) {
    return (e) => {
      e.preventDefault()
      
      const container = e.target.closest('.split-container')
      if (!container) return
      
      const isHorizontal = layoutNode.direction === 'horizontal'
      const startPos = isHorizontal ? e.clientX : e.clientY
      const startSizes = [...layoutNode.sizes]
      
      const handleMouseMove = (moveEvent) => {
        const currentPos = isHorizontal ? moveEvent.clientX : moveEvent.clientY
        const containerSize = isHorizontal ? container.offsetWidth : container.offsetHeight
        
        // Calculer le delta en pourcentage depuis la position de départ
        const deltaPixels = currentPos - startPos
        const deltaPercent = (deltaPixels / containerSize) * 100
        
        // Mettre à jour les tailles des deux panneaux adjacents
        const newSizes = [...startSizes]
        const newFirstSize = Math.max(5, Math.min(95, startSizes[splitIndex] + deltaPercent))
        const newSecondSize = Math.max(5, Math.min(95, startSizes[splitIndex + 1] - deltaPercent))
        
        // S'assurer que la somme reste cohérente
        const sizeDiff = (newFirstSize + newSecondSize) - (startSizes[splitIndex] + startSizes[splitIndex + 1])
        
        newSizes[splitIndex] = newFirstSize
        newSizes[splitIndex + 1] = newSecondSize
        
        // Appliquer les nouvelles tailles
        layoutService.updateSizes(layoutNode.id, newSizes)
      }

      const handleMouseUp = () => {
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
      }

      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = isHorizontal ? 'ew-resize' : 'ns-resize'
      document.body.style.userSelect = 'none'
    }
  }

  // État réactif pour l'onglet actif
  let activeTabData = $state(null)

  $effect(() => {
    if (layoutNode.activeTab) {
      activeTabData = layoutNode.tabs.find(tab => tab.id === layoutNode.activeTab) || null
    } else {
      activeTabData = null
    }
  })
</script>

<!-- Rendu récursif : Container ou TabGroup -->
{#if layoutNode.type === 'container'}
  <!-- Split container avec direction et tailles -->
  <div 
    class="split-container" 
    class:horizontal={layoutNode.direction === 'horizontal'} 
    class:vertical={layoutNode.direction === 'vertical'}
  >
    {#each layoutNode.children as childNode, index (childNode.id)}
      <div 
        class="split-pane" 
        style:flex="0 0 {layoutNode.sizes[index] || 50}%"
        style:width={layoutNode.direction === 'horizontal' ? `${layoutNode.sizes[index] || 50}%` : 'auto'}
        style:height={layoutNode.direction === 'vertical' ? `${layoutNode.sizes[index] || 50}%` : 'auto'}
      >
        <LayoutContainer layoutNode={childNode} />
      </div>
      
      {#if index < layoutNode.children.length - 1}
        <ResizeHandle 
          direction={layoutNode.direction === 'horizontal' ? 'vertical' : 'horizontal'} 
          onResizeStart={createResizeHandler(index)} 
        />
      {/if}
    {/each}
  </div>

{:else if layoutNode.type === 'tabgroup'}
  <!-- Groupe d'onglets -->
  <div class="tabgroup">
    {#if layoutNode.tabs.length > 0}
      <div class="tab-bar">
        {#each layoutNode.tabs as tab (tab.id)}
          <div 
            class="tab"
            class:active={tab.id === layoutNode.activeTab}
            class:dragging={draggedTab?.id === tab.id}
            class:drag-over={dragOverTab?.id === tab.id}
            data-context-menu
            onclick={() => selectTab(tab.id)}
            oncontextmenu={(e) => handleTabContextMenu(e, tab)}
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
          <p>Sélectionner un outil pour commencer</p>
        </div>
      </div>
    {/if}
  </div>
{/if}

<style>
  /* Split Container */
  .split-container {
    flex: 1;
    display: flex;
    overflow: hidden;
    min-width: 0;
    min-height: 0;
    gap: 2px;
    background: #3c3c3c;
    height: 100%; /* Important pour les splits verticaux */
  }

  .split-container.horizontal {
    flex-direction: row;
  }

  .split-container.vertical {
    flex-direction: column;
  }

  .split-pane {
    min-width: 0;
    min-height: 0;
    overflow: hidden;
    background: #1e1e1e;
    display: flex; /* Important pour propager la hauteur */
    flex-direction: column;
  }

  /* Tab Group */
  .tabgroup {
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
    overflow-x: auto;
    scrollbar-width: none;
    min-width: 0;
    flex-shrink: 0;
  }

  .tab-bar::-webkit-scrollbar {
    display: none;
  }

  .tab {
    display: flex;
    align-items: center;
    padding: 8px 12px;
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
    flex-shrink: 0;
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
    margin-left: 8px;
    padding: 0;
    width: 16px;
    height: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 2px;
    flex-shrink: 0;
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
