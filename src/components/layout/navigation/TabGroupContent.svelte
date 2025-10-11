<script>
  import { layoutService } from '@/core/LayoutService.svelte.js'
  import { dragDropService } from '@/core/DragDropService.svelte.js'

  let { layoutNode } = $props()

  let activeTabData = $state(null)
  let activeTabScrollMode = $state('ide')

  $effect(() => {
    const globalFocusedTab = layoutService.globalFocusedTab
    const globalTabInThisGroup = globalFocusedTab ?
      layoutNode.tabs.find(tab => tab.id === globalFocusedTab) : null

    if (globalTabInThisGroup) {
      activeTabData = globalTabInThisGroup
    } else {
      activeTabData = layoutNode.tabs.find(tab => tab.id === layoutNode.activeTab)
    }

    activeTabScrollMode = activeTabData ? (activeTabData.scrollMode || 'ide') : 'ide'
  })

  function handleEmptyAreaDragOver(e) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'

    const dragInfo = dragDropService.getDragInfo()
    if (!dragInfo.draggedTab) return

    const rect = e.currentTarget.getBoundingClientRect()
    dragDropService.setDropPreviewZone(layoutNode.id, 'tabbar', rect)
  }

  function handleEmptyAreaDrop(e) {
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

{#if activeTabData && activeTabData.component}
  {@const Component = activeTabData.component}
  {#snippet renderComponent()}
    {#if activeTabData.fileContent}
      <Component
        content={activeTabData.fileContent}
        fileName={activeTabData.fileName}
        {...activeTabData}
      />
    {:else}
      <Component {...activeTabData} />
    {/if}
  {/snippet}
  {#if activeTabScrollMode === 'tool'}
    {@render renderComponent()}
  {:else}
    <div class="tab-scroll-surface">
      {@render renderComponent()}
    </div>
  {/if}
{:else if activeTabData}
  <div class="placeholder">
    <h3>{activeTabData.title}</h3>
    <p>Contenu Ã  implÃ©menter</p>
  </div>
{:else}
  <!-- Zone de drop pour tabgroup vide -->
  <div
    class="empty-tabgroup"
    class:drag-over={dragDropService.hasDropPreview(layoutNode.id) && dragDropService.getDropPreview(layoutNode.id)?.zone === 'tabbar'}
    ondragover={handleEmptyAreaDragOver}
    ondrop={handleEmptyAreaDrop}
    ondragleave={() => dragDropService.clearDragTarget()}
    role="region"
    aria-label="Zone de dÃ©pÃ´t vide"
  >
    <div class="empty-message">
      <span class="empty-icon">ðŸ“‚</span>
      <p>Glissez un onglet ici</p>
    </div>
  </div>
{/if}

<style>
  .tab-scroll-surface {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: auto;
    min-height: 0;
    height: 100%;
  }

  .placeholder {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    color: #858585;
    padding: 20px;
  }

  .placeholder h3 {
    margin: 0 0 10px 0;
    color: #cccccc;
  }

  .empty-tabgroup {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #1e1e1e;
    border: 2px dashed #3e3e42;
    margin: 8px;
    border-radius: 8px;
    transition: all 0.15s ease;
    min-height: 200px;
  }

  .empty-tabgroup.drag-over {
    border-color: #007acc;
    background: rgba(0, 122, 204, 0.1);
  }

  .empty-message {
    text-align: center;
    color: #858585;
  }

  .empty-icon {
    font-size: 48px;
    display: block;
    margin-bottom: 16px;
    opacity: 0.5;
  }

  .empty-message p {
    margin: 0;
    font-size: 14px;
  }
</style>