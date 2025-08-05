<script>
  import { ideStore } from '@/stores/ideStore.svelte.js'
  import { layoutService } from '@/core/LayoutService.svelte.js'
  import { dragDropService } from '@/core/DragDropService.svelte.js'

  let { 
    tab, 
    isActive = false,
    groupId,
    layoutNode,
    onSelect,
    onClose,
    onContextMenu,
    onDragStart
  } = $props()

  function handleClick() {
    onSelect?.(tab.id)
  }

  function handleClose(e) {
    e.stopPropagation()
    onClose?.(e, tab.id)
  }

  function handleContextMenu(e) {
    e.preventDefault()
    onContextMenu?.(e, tab)
  }

  function handleDragStart(e) {
    onDragStart?.(e, tab)
  }

  function handleDragOver(e, targetTab) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    
    const dragInfo = dragDropService.getDragInfo()
    if (!dragInfo.draggedTab || dragInfo.draggedTab.id === targetTab.id) return
    
    dragDropService.setDragTarget(groupId, targetTab)
  }

  function handleDragLeave(e) {
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
    const targetGroupId = groupId
    const draggedTabId = dragInfo.draggedTab.id

    if (sourceGroupId === targetGroupId) {
      const draggedIndex = dragInfo.draggedIndex
      const targetIndex = targetTab.index || 0
      
      if (draggedIndex !== targetIndex) {
        const tabs = [...layoutNode.tabs]
        const [draggedTab] = tabs.splice(draggedIndex, 1)
        tabs.splice(targetIndex, 0, draggedTab)
        
        layoutService.reorderTabsInGroup(targetGroupId, tabs)
      }
    } else {
      layoutService.moveTabBetweenGroups(
        draggedTabId,
        sourceGroupId,
        targetGroupId,
        targetTab.index || -1
      )
    }
    
    dragDropService.endDrag()
  }

  function handleDragEnd() {
    dragDropService.endDrag()
  }
</script>

<div 
  class="tab"
  class:active={isActive}
  class:dragging={dragDropService.isTabBeingDragged(tab.id)}
  class:drag-over={dragDropService.isTabDragTarget(tab.id)}
  data-context-menu
  data-tab-id={tab.id}
  onclick={handleClick}
  onkeydown={(e) => e.key === 'Enter' && handleClick()}
  oncontextmenu={handleContextMenu}
  ondragstart={handleDragStart}
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
      onclick={handleClose}
    >
      ×
    </button>
  {/if}
</div>

<style>
  .tab {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 12px;
    background: #2d2d30;
    color: #cccccc;
    border-right: 1px solid #3e3e42;
    cursor: pointer;
    user-select: none;
    white-space: nowrap;
    min-width: 0;
    flex-shrink: 0;
    transition: background-color 0.15s ease, color 0.15s ease;
    position: relative;
  }

  .tab:hover {
    background: #383838;
    color: #ffffff;
  }

  .tab.active {
    background: #1e1e1e;
    color: #ffffff;
    border-bottom: 2px solid #007acc;
  }

  .tab.dragging {
    opacity: 0.5;
    cursor: grabbing;
  }

  .tab.drag-over {
    background: #094771;
    border-left: 2px solid #007acc;
  }

  .tab-title {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .tab-icon {
    flex-shrink: 0;
    font-size: 12px;
  }

  .modified-indicator {
    color: #f48771;
    font-weight: bold;
    flex-shrink: 0;
  }

  .close-tab-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 16px;
    background: none;
    border: none;
    color: #858585;
    cursor: pointer;
    border-radius: 2px;
    margin-left: 8px;
    flex-shrink: 0;
    font-size: 14px;
    line-height: 1;
    transition: background-color 0.15s ease, color 0.15s ease;
  }

  .close-tab-btn:hover {
    background: #e81123;
    color: white;
  }
</style>
