<script>
  import { layoutService } from '@/core/LayoutService.svelte.js'
  import { dragDropService } from '@/core/DragDropService.svelte.js'
  import { eventBus } from '@/core/EventBusService.svelte.js'
  import { panelsManager } from '@/core/PanelsManager.svelte.js'
  import { SCROLL_MODES } from '@/core/ScrollModes.svelte.js'

  let { layoutNode } = $props()

  let activeTabData = $state(null)
  let activeTabScrollMode = $state(SCROLL_MODES.ide)

  $effect(() => {
    const globalFocusedTab = layoutService.globalFocusedTab
    const globalTabInThisGroup = globalFocusedTab ?
      layoutNode.tabs.find(tab => tab.id === globalFocusedTab) : null

    if (globalTabInThisGroup) {
      activeTabData = globalTabInThisGroup
    } else {
      activeTabData = layoutNode.tabs.find(tab => tab.id === layoutNode.activeTab)
    }

    activeTabScrollMode = activeTabData ? (activeTabData.scrollMode || SCROLL_MODES.ide) : SCROLL_MODES.ide

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

  function focusTabContent(tab) {
    if (!tab) return
    const changed = layoutService.setGlobalFocus(tab.id)
    if (panelsManager) {
      panelsManager.clearFocus()
    }
    if (changed) {
      eventBus.publish('tabs:focus-changed', { tab })
    }
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
  <div
    class="tab-content-root"
    onfocusin={() => focusTabContent(activeTabData)}
    onpointerdown={() => focusTabContent(activeTabData)}
  >
    {#if activeTabScrollMode === SCROLL_MODES.tool}
      {@render renderComponent()}
    {:else}
      <div class="tab-scroll-surface">
        {@render renderComponent()}
      </div>
    {/if}
  </div>
{:else if activeTabData}
  <div class="placeholder">
    <h3>{activeTabData.title}</h3>
    <p>Contenu a implementer</p>
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
    aria-label="Zone de depot vide"
  >
    <div class="empty-message">
      <span class="empty-icon" aria-hidden="true">[ ]</span>
      <p>Glissez un onglet ici</p>
    </div>
  </div>
{/if}

<style>
.tab-content-root {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.tab-scroll-surface {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: auto;
  min-height: 0;
    height: 100%;
    scrollbar-width: thin;
    scrollbar-color: rgba(255, 255, 255, 0.25) transparent;
  }

  .tab-scroll-surface::-webkit-scrollbar {
    width: 6px;
  }

  .tab-scroll-surface::-webkit-scrollbar-track {
    background: rgba(255, 255, 255, 0.03);
  }

  .tab-scroll-surface::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.2);
    border-radius: 3px;
  }

  .tab-scroll-surface::-webkit-scrollbar-thumb:hover {
    background: rgba(255, 255, 255, 0.3);
  }

  .tab-scroll-surface::-webkit-scrollbar-thumb:active {
    background: rgba(255, 255, 255, 0.4);
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
