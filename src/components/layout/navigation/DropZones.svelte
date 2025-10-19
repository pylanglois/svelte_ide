<script>
  import { dragDropService } from '@/core/DragDropService.svelte.js'
  import { layoutService } from '@/core/LayoutService.svelte.js'

  let { layoutNode, children } = $props()
  let activeTabId = $state(null)

  function handleContentAreaDragOver(e) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    
    const dragInfo = dragDropService.getDragInfo()
    if (!dragInfo.draggedTab) return

    const rect = e.currentTarget.getBoundingClientRect()
    
    // Utiliser la méthode correcte du service avec rect et coordonnées mouse
    dragDropService.setDropPreview(layoutNode.id, rect, e.clientX, e.clientY)
  }

  function handleContentAreaDrop(e) {
    e.preventDefault()
    
    const dragInfo = dragDropService.getDragInfo()
    if (!dragInfo.draggedTab) return

    const sourceGroupId = dragInfo.sourceGroup
    const targetGroupId = layoutNode.id
    const draggedTabId = dragInfo.draggedTab.id

    if (dragInfo.dropPreview && dragInfo.dropPreview.groupId === layoutNode.id) {
      const zone = dragInfo.dropPreview.zone
      
      if (sourceGroupId === targetGroupId && zone === 'center') {
        dragDropService.endDrag()
        return
      }
      
      if (sourceGroupId === targetGroupId && zone !== 'center') {
        if (layoutNode.tabs.length < 2) {
          dragDropService.endDrag()
          return
        }
      }
      
      layoutService.createSplitFromDropZone(
        targetGroupId,
        zone,
        draggedTabId,
        sourceGroupId
      )
    } else {
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

  $effect(() => {
    const globalFocusedId = layoutService.globalFocusedTab
    const preferredId = globalFocusedId && layoutNode.tabs.some(tab => tab.id === globalFocusedId)
      ? globalFocusedId
      : layoutNode.activeTab
    activeTabId = preferredId || null
  })
</script>

<!-- Zone de contenu - DROP pour split -->
<div 
  class="tab-content"
  ondragover={handleContentAreaDragOver}
  ondrop={handleContentAreaDrop}
  ondragleave={() => dragDropService.clearDragTarget()}
  role="tabpanel"
  tabindex="0"
  id={`panel-${layoutNode.id}`}
  aria-labelledby={activeTabId ? `tab-${activeTabId}` : undefined}
>
  <!-- Zones de drop pour créer des splits -->
  {#if dragDropService.isDragging}
    {#if dragDropService.hasDropPreview(layoutNode.id)}
      {@const preview = dragDropService.getDropPreview(layoutNode.id)}
      {@const dragInfo = dragDropService.getDragInfo()}
      {@const isInternal = dragInfo.sourceGroup === layoutNode.id}
      {@const hasExistingFile = (preview.zone === 'center' || preview.zone === 'tabbar') && layoutNode.tabs.some(t => 
        t.id === dragInfo.draggedTab.id || (dragInfo.draggedTab.fileName && t.fileName === dragInfo.draggedTab.fileName)
      )}
      {@const isInvalidInternal = isInternal && (preview.zone === 'center' || layoutNode.tabs.length < 2)}
      {@const isInvalid = isInvalidInternal || hasExistingFile}
      <div 
        class="drop-preview"
        class:center={preview.zone === 'center'}
        class:top={preview.zone === 'top'}
        class:bottom={preview.zone === 'bottom'}
        class:left={preview.zone === 'left'}
        class:right={preview.zone === 'right'}
        class:tabbar={preview.zone === 'tabbar'}
        class:invalid={isInvalid}
        style:left={preview.zone === 'tabbar' ? `${preview.rect.left}px` : ''}
        style:top={preview.zone === 'tabbar' ? `${preview.rect.top}px` : ''}
        style:width={preview.zone === 'tabbar' ? `${preview.rect.width}px` : ''}
        style:height={preview.zone === 'tabbar' ? `${preview.rect.height}px` : ''}
      ></div>
    {/if}
  {/if}

  {@render children?.()}
</div>

<style>
  .tab-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    background: #1e1e1e;
    position: relative;
  }

  .drop-preview {
    position: absolute;
    background: rgba(255, 255, 255, 0.3);
    border: 2px solid rgba(255, 255, 255, 0.6);
    pointer-events: none;
    z-index: 1000;
    transition: all 0.1s ease;
  }

  .drop-preview.invalid {
    background: rgba(255, 0, 0, 0.2);
    border-color: rgba(255, 0, 0, 0.6);
  }

  .drop-preview.center {
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
  }

  .drop-preview.top {
    top: 0;
    left: 0;
    right: 0;
    height: 50%;
  }

  .drop-preview.bottom {
    bottom: 0;
    left: 0;
    right: 0;
    height: 50%;
  }

  .drop-preview.left {
    top: 0;
    left: 0;
    bottom: 0;
    width: 50%;
  }

  .drop-preview.right {
    top: 0;
    right: 0;
    bottom: 0;
    width: 50%;
  }

  .drop-preview.tabbar {
    position: fixed;
    background: rgba(0, 122, 204, 0.3);
    border-color: rgba(0, 122, 204, 0.6);
    z-index: 1001;
  }

  .drop-preview.tabbar.invalid {
    background: rgba(255, 68, 68, 0.3);
    border-color: rgba(255, 68, 68, 0.6);
  }
</style>
