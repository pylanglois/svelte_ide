<script>
  import { ideStore } from '@/stores/ideStore.svelte.js'
  import { contextMenuService } from '@/core/ContextMenuService.svelte.js'
  import { layoutService } from '@/core/LayoutService.svelte.js'
  import { dragDropService } from '@/core/DragDropService.svelte.js'
  import ResizeHandle from '@/components/layout/ResizeHandle.svelte'
  import TabScrollContainer from '@/components/layout/TabScrollContainer.svelte'
  import LayoutContainer from './LayoutContainer.svelte'

  let { layoutNode } = $props()
  let tabScrollContainer = $state(null)

  // Effet pour faire défiler automatiquement vers l'onglet actif
  $effect(() => {
    if (tabScrollContainer && tabScrollContainer._scrollToTab && layoutNode.activeTab) {
      tabScrollContainer._scrollToTab(layoutNode.activeTab)
    }
  })

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
    dragDropService.startDrag(tab, layoutNode.id)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/html', '')
    
    // Curseur personnalisé pour le drag
    document.body.style.cursor = 'grabbing'
    
    // Créer une image de drag personnalisée
    const dragImage = document.createElement('div')
    dragImage.textContent = `📄 ${tab.title}`
    dragImage.style.cssText = `
      position: absolute;
      top: -1000px;
      background: #2d2d30;
      color: white;
      padding: 8px 12px;
      border-radius: 4px;
      font-size: 12px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      pointer-events: none;
    `
    document.body.appendChild(dragImage)
    e.dataTransfer.setDragImage(dragImage, 50, 20)
    
    // Nettoyer l'élément après un court délai
    setTimeout(() => {
      document.body.removeChild(dragImage)
    }, 0)
  }

  function handleDragOver(e, tab) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    
    // Pour les tabs, on ne gère que le drag over direct (pas les zones de bord)
    dragDropService.setDragTarget(layoutNode.id, tab)
  }

  function handleDragLeave(e) {
    // Vérifier si on quitte vraiment le groupe (pas juste un enfant)
    const rect = e.currentTarget.getBoundingClientRect()
    const { clientX, clientY } = e
    
    if (clientX < rect.left || clientX > rect.right || 
        clientY < rect.top || clientY > rect.bottom) {
      dragDropService.clearDragTarget()
    }
  }

  function handleDrop(e, targetTab) {
    e.preventDefault()
    
    const dragInfo = dragDropService.getDragInfo()
    if (!dragInfo.draggedTab) return

    const sourceGroupId = dragInfo.sourceGroup
    const targetGroupId = layoutNode.id
    const draggedTabId = dragInfo.draggedTab.id

    // Vérifier si on drop sur une zone de bord pour créer un split
    if (dragInfo.edgeDropZone && dragInfo.edgeDropZone.groupId === layoutNode.id) {
      layoutService.createSplitFromEdgeDrop(
        targetGroupId,
        dragInfo.edgeDropZone.edge,
        draggedTabId,
        sourceGroupId
      )
    } else if (sourceGroupId === targetGroupId) {
      // Drag & drop dans le même groupe (réorganisation)
      if (targetTab && draggedTabId !== targetTab.id) {
        const tabs = [...layoutNode.tabs]
        const draggedIndex = tabs.findIndex(t => t.id === draggedTabId)
        const targetIndex = tabs.findIndex(t => t.id === targetTab.id)
        
        const [removed] = tabs.splice(draggedIndex, 1)
        tabs.splice(targetIndex, 0, removed)
        
        layoutService.reorderTabsInGroup(layoutNode.id, tabs)
      }
    } else {
      // Drag & drop entre groupes différents
      const targetPosition = targetTab 
        ? layoutNode.tabs.findIndex(t => t.id === targetTab.id)
        : -1
      
      layoutService.moveTabBetweenGroups(
        draggedTabId, 
        sourceGroupId, 
        targetGroupId, 
        targetPosition
      )
    }
    
    dragDropService.endDrag()
  }

  function handleDragEnd() {
    dragDropService.endDrag()
  }

  function handleTabAreaDragOver(e) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    
    const dragInfo = dragDropService.getDragInfo()
    if (!dragInfo.draggedTab) return
    
    // Marquer la zone d'onglets comme cible de drop
    dragDropService.setTabAreaTarget(layoutNode.id)
    
    // TODO: Animation de prévisualisation d'insertion dans les onglets
  }

  function handleTabAreaDrop(e) {
    e.preventDefault()
    
    const dragInfo = dragDropService.getDragInfo()
    if (!dragInfo.draggedTab) return

    const sourceGroupId = dragInfo.sourceGroup
    const targetGroupId = layoutNode.id
    const draggedTabId = dragInfo.draggedTab.id

    // Ajouter l'onglet au groupe existant (à la fin)
    if (sourceGroupId !== targetGroupId) {
      layoutService.moveTabBetweenGroups(
        draggedTabId, 
        sourceGroupId, 
        targetGroupId, 
        -1 // À la fin
      )
    }
    
    dragDropService.endDrag()
  }

  function handleContentAreaDragOver(e) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    
    const dragInfo = dragDropService.getDragInfo()
    
    // Calculer et définir la zone de prévisualisation pour split
    const rect = e.currentTarget.getBoundingClientRect()
    dragDropService.setDropPreview(layoutNode.id, rect, e.clientX, e.clientY)
  }

  function handleContentAreaDrop(e) {
    e.preventDefault()
    
    const dragInfo = dragDropService.getDragInfo()
    if (!dragInfo.draggedTab) return

    const sourceGroupId = dragInfo.sourceGroup
    const targetGroupId = layoutNode.id
    const draggedTabId = dragInfo.draggedTab.id

    // Vérifier si on a une prévisualisation de drop pour split
    if (dragInfo.dropPreview && dragInfo.dropPreview.groupId === layoutNode.id) {
      const zone = dragInfo.dropPreview.zone
      
      // Si c'est un drag interne avec split, vérifier qu'il y a assez d'onglets
      if (sourceGroupId === targetGroupId && zone !== 'center') {
        // Il faut au moins 2 onglets pour faire un split interne
        if (layoutNode.tabs.length < 2) {
          dragDropService.endDrag()
          return
        }
      }

      // Procéder avec le split ou merge
      layoutService.createSplitFromDropZone(
        targetGroupId,
        zone,
        draggedTabId,
        sourceGroupId
      )
    }
    
    dragDropService.endDrag()
  }

  function handleTabGroupAreaDragOver(e) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    
    const dragInfo = dragDropService.getDragInfo()
    
    // Calculer et définir la zone de prévisualisation
    const rect = e.currentTarget.getBoundingClientRect()
    dragDropService.setDropPreview(layoutNode.id, rect, e.clientX, e.clientY)
  }

  function handleTabGroupAreaDrop(e) {
    e.preventDefault()
    
    const dragInfo = dragDropService.getDragInfo()
    if (!dragInfo.draggedTab) return

    const sourceGroupId = dragInfo.sourceGroup
    const targetGroupId = layoutNode.id
    const draggedTabId = dragInfo.draggedTab.id

    // Vérifier si on a une prévisualisation de drop
    if (dragInfo.dropPreview && dragInfo.dropPreview.groupId === layoutNode.id) {
      const zone = dragInfo.dropPreview.zone
      
      // Si c'est un drag interne ET zone center, ne rien faire (pas utile)
      if (sourceGroupId === targetGroupId && zone === 'center') {
        dragDropService.endDrag()
        return
      }
      
      // Si c'est un drag interne avec split, vérifier qu'il y a assez d'onglets
      if (sourceGroupId === targetGroupId && zone !== 'center') {
        // Il faut au moins 2 onglets pour faire un split interne
        if (layoutNode.tabs.length < 2) {
          dragDropService.endDrag()
          return
        }
      }
      
      // Procéder avec le split ou merge
      layoutService.createSplitFromDropZone(
        targetGroupId,
        zone,
        draggedTabId,
        sourceGroupId
      )
    } else {
      // Drop normal (fallback) - seulement pour les drags entre groupes différents
      if (sourceGroupId !== targetGroupId) {
        layoutService.moveTabBetweenGroups(
          draggedTabId, 
          sourceGroupId, 
          targetGroupId, 
          -1
        )
      }
    }
    
    dragDropService.endDrag()
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
  <!-- Groupe d'onglets avec zones de drop séparées -->
  <div class="tabgroup">
    {#if layoutNode.tabs.length > 0}
      <!-- Zone d'onglets - DROP pour ajouter au groupe -->
      <div 
        class="tab-area"
        class:drag-over={dragDropService.isTabAreaTarget(layoutNode.id)}
        ondragover={handleTabAreaDragOver}
        ondrop={handleTabAreaDrop}
        ondragleave={() => dragDropService.clearTabAreaTarget()}
      >
        <TabScrollContainer bind:this={tabScrollContainer}>
        {#each layoutNode.tabs as tab (tab.id)}
          <div 
            class="tab"
            class:active={tab.id === layoutNode.activeTab}
            class:dragging={dragDropService.isTabBeingDragged(tab.id)}
            class:drag-over={dragDropService.isTabDragTarget(tab.id)}
            data-context-menu
            data-tab-id={tab.id}
            onclick={() => selectTab(tab.id)}
            oncontextmenu={(e) => handleTabContextMenu(e, tab)}
            ondragstart={(e) => handleDragStart(e, tab)}
            ondragover={(e) => handleDragOver(e, tab)}
            ondragleave={handleDragLeave}
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
              {#if ideStore.isTabModified(tab.id)}
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
        </TabScrollContainer>
      </div>
      
      <!-- Zone de contenu - DROP pour split -->
      <div 
        class="tab-content"
        ondragover={handleContentAreaDragOver}
        ondrop={handleContentAreaDrop}
        ondragleave={() => dragDropService.clearDragTarget()}
      >
        <!-- Zones de drop pour créer des splits -->
        {#if dragDropService.isDragging}
          <!-- Prévisualisation IntelliJ-style pour le drag & drop -->
          {#if dragDropService.hasDropPreview(layoutNode.id)}
            {@const preview = dragDropService.getDropPreview(layoutNode.id)}
            {@const dragInfo = dragDropService.getDragInfo()}
            {@const isInternal = dragInfo.sourceGroup === layoutNode.id}
            {@const isInvalidInternal = isInternal && (preview.zone === 'center' || layoutNode.tabs.length < 2)}
            <div 
              class="drop-preview"
              class:center={preview.zone === 'center'}
              class:top={preview.zone === 'top'}
              class:bottom={preview.zone === 'bottom'}
              class:left={preview.zone === 'left'}
              class:right={preview.zone === 'right'}
              class:invalid={isInvalidInternal}
            ></div>
          {/if}
        {/if}

        {#if activeTabData && activeTabData.component}
          {@const Component = activeTabData.component}
          {#if activeTabData.fileContent}
            <Component 
              content={activeTabData.fileContent} 
              fileName={activeTabData.fileName}
              {...activeTabData}
            />
          {:else}
            <Component {...activeTabData} />
          {/if}
        {:else if activeTabData}
          <div class="placeholder">
            <h3>{activeTabData.title}</h3>
            <p>Contenu à implémenter</p>
          </div>
        {/if}
      </div>
    {:else}
      <!-- Zone de drop pour tabgroup vide -->
      <div 
        class="empty-state"
        class:drag-target={dragDropService.isGroupDragTarget(layoutNode.id)}
        ondragover={handleTabGroupAreaDragOver}
        ondrop={handleTabGroupAreaDrop}
        ondragleave={() => dragDropService.clearDragTarget()}
      >
        <div class="empty-content">
          <h2>Bienvenue</h2>
          <p>Sélectionner un outil pour commencer</p>
          {#if dragDropService.isDragging}
            <p class="drop-hint">📁 Déposer l'onglet ici</p>
          {/if}
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
    background: #3c3c3c;
    height: 100%;
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
    position: relative;
  }

  .tab-area {
    flex-shrink: 0;
    background: #2d2d30;
    border-bottom: 1px solid #3e3e42;
    position: relative;
  }

  .tab-area.drag-over {
    background: rgba(0, 122, 204, 0.1);
    border-bottom: 2px solid #007acc;
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
    transition: all 0.3s ease;
    cursor: grabbing;
  }

  .tab.drag-over {
    background: #007acc;
    transform: scale(1.05);
    transition: all 0.2s ease;
    box-shadow: 0 0 10px rgba(0, 122, 204, 0.5);
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
    position: relative;
  }

  /* Prévisualisation de drop limitée à la zone de contenu */
  .tab-content .drop-preview {
    position: absolute;
    background: rgba(255, 255, 255, 0.3);
    border: 2px solid rgba(255, 255, 255, 0.6);
    pointer-events: none;
    z-index: 1000;
    transition: all 0.1s ease;
  }

  .tab-content .drop-preview.invalid {
    background: rgba(255, 0, 0, 0.2);
    border: 2px solid rgba(255, 0, 0, 0.4);
  }

  .tab-content .drop-preview.center {
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(255, 255, 255, 0.2);
    border: 2px solid rgba(255, 255, 255, 0.4);
  }

  .tab-content .drop-preview.top {
    top: 0;
    left: 0;
    right: 0;
    height: 50%;
  }

  .tab-content .drop-preview.bottom {
    bottom: 0;
    left: 0;
    right: 0;
    height: 50%;
  }

  .tab-content .drop-preview.left {
    top: 0;
    left: 0;
    bottom: 0;
    width: 50%;
  }

  .tab-content .drop-preview.right {
    top: 0;
    right: 0;
    bottom: 0;
    width: 50%;
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
    transition: all 0.3s ease;
    min-height: 100px;
    border: 2px dashed transparent;
  }

  .empty-state.drag-target {
    background: #2a4d3a;
    border-color: #007acc;
    box-shadow: 0 0 10px rgba(0, 122, 204, 0.3);
    animation: pulse-empty 2s infinite;
  }

  @keyframes pulse-empty {
    0%, 100% { 
      background: #2a4d3a;
      box-shadow: 0 0 10px rgba(0, 122, 204, 0.3);
    }
    50% { 
      background: #2d5a3d;
      box-shadow: 0 0 15px rgba(0, 122, 204, 0.5);
    }
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

  .drop-hint {
    font-size: 16px;
    color: #007acc !important;
    opacity: 1 !important;
    margin-top: 8px;
    animation: pulse 2s infinite;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.6; }
  }
</style>
