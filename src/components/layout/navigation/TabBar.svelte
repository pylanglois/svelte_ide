<script>
  import { ideStore } from '@/stores/ideStore.svelte.js'
  import { contextMenuService } from '@/core/ContextMenuService.svelte.js'
  import { layoutService } from '@/core/LayoutService.svelte.js'
  import { dragDropService } from '@/core/DragDropService.svelte.js'
  import TabScrollContainer from './TabScrollContainer.svelte'
  import Tab from './Tab.svelte'

  let { layoutNode } = $props()
  let tabScrollContainer = $state(null)

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
    
    e.target.style.cursor = 'grabbing'
    
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
    
    e.dataTransfer.setDragImage(dragImage, 0, 0)
    
    setTimeout(() => {
      if (document.body.contains(dragImage)) {
        document.body.removeChild(dragImage)
      }
    }, 0)
  }

  function handleTabAreaDragOver(e) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    
    const dragInfo = dragDropService.getDragInfo()
    if (!dragInfo.draggedTab) return
    
    const rect = e.currentTarget.getBoundingClientRect()
    dragDropService.setDropPreviewZone(layoutNode.id, 'tabbar', rect)
  }

  function handleTabAreaDrop(e) {
    e.preventDefault()
    
    const dragInfo = dragDropService.getDragInfo()
    if (!dragInfo.draggedTab) return

    const sourceGroupId = dragInfo.sourceGroup
    const targetGroupId = layoutNode.id
    const draggedTabId = dragInfo.draggedTab.id

    if (dragInfo.dropPreview?.zone === 'tabbar') {
      layoutService.moveTabBetweenGroups(
        draggedTabId,
        sourceGroupId,
        targetGroupId,
        -1
      )
    }
    
    dragDropService.endDrag()
  }
</script>

<div 
  class="tab-area"
  class:drag-over={dragDropService.hasDropPreview(layoutNode.id) && dragDropService.getDropPreview(layoutNode.id)?.zone === 'tabbar'}
  ondragover={handleTabAreaDragOver}
  ondrop={handleTabAreaDrop}
  ondragleave={() => dragDropService.clearDragTarget()}
  role="tablist"
  tabindex="0"
>
  <TabScrollContainer bind:this={tabScrollContainer}>
    {#each layoutNode.tabs as tab (tab.id)}
      <Tab 
        {tab}
        isActive={tab.id === layoutNode.activeTab}
        groupId={layoutNode.id}
        {layoutNode}
        onSelect={selectTab}
        onClose={closeTab}
        onContextMenu={handleTabContextMenu}
        onDragStart={handleDragStart}
      />
    {/each}
  </TabScrollContainer>
</div>

<style>
  .tab-area {
    display: flex;
    background: #2d2d30;
    border-bottom: 1px solid #3e3e42;
    overflow: hidden;
    position: relative;
    min-height: 35px;
  }

  .tab-area.drag-over {
    background: #094771;
    box-shadow: inset 0 0 0 2px #007acc;
  }

  .tab-area.drag-over-invalid {
    background: #4a1a1a;
    box-shadow: inset 0 0 0 2px #ff4444;
  }
</style>
