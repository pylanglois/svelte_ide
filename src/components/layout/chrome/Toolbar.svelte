<script>
  import { ideStore } from '@/stores/ideStore.svelte.js'

  let { position } = $props()

  const isLeft = position === 'left'

  let topTools = $state([])
  let bottomTools = $state([])
  let sharedBottomTools = $state([])
  let activePanels = $state(new Map())
  let focusedPanelId = $state(null)

  $effect(() => {
    topTools = isLeft ? ideStore.topLeftTools : ideStore.topRightTools
    bottomTools = isLeft ? ideStore.bottomLeftTools : ideStore.bottomRightTools
    sharedBottomTools = isLeft ? ideStore.bottomTools : []
  })

  $effect(() => {
    const manager = ideStore.panelsManager
    if (!manager) {
      activePanels = new Map()
      focusedPanelId = null
      return
    }

    function refresh() {
      const next = new Map()
      manager.activePanelsByPosition.forEach((panel) => {
        if (panel && panel.toolId) {
          next.set(panel.toolId, panel.id)
        }
      })
      activePanels = next
      focusedPanelId = manager.getFocusedPanel()
    }

    manager.addChangeCallback(refresh)
    refresh()
    return () => manager.removeChangeCallback(refresh)
  })

  const topTarget = isLeft ? 'topLeft' : 'topRight'
  const bottomTarget = isLeft ? 'bottomLeft' : 'bottomRight'

  function handleToolClick(tool) {
    const manager = ideStore.panelsManager
    if (!manager || !tool.panelId) return
    manager.togglePanel(tool.panelId, tool.component)
  }

  function handleDragStart(e, tool) {
    e.dataTransfer.setData('text/plain', tool.id)
    e.dataTransfer.effectAllowed = 'move'
    ideStore.draggedTool = tool
    ideStore.draggedToolSource = tool.position
  }

  function handleDragEnd() {
    ideStore.draggedTool = null
    ideStore.draggedToolSource = null
    ideStore.dragOverZone = null
  }

  function handleDragOver(e, targetPosition) {
    e.preventDefault()
    if (ideStore.draggedTool && ideStore.draggedToolSource !== targetPosition) {
      ideStore.dragOverZone = targetPosition
      e.dataTransfer.dropEffect = 'move'
    } else {
      e.dataTransfer.dropEffect = 'none'
    }
  }

  function handleDragLeave(targetPosition) {
    if (ideStore.dragOverZone === targetPosition) {
      ideStore.dragOverZone = null
    }
  }

  function handleDrop(targetPosition) {
    if (ideStore.draggedTool && ideStore.draggedToolSource !== targetPosition) {
      ideStore.moveTool(ideStore.draggedTool.id, targetPosition)
    }
    handleDragEnd()
  }

  function isToolActive(tool) {
    return activePanels.has(tool.id)
  }

  function isToolFocused(tool) {
    if (!activePanels.has(tool.id)) return false
    return focusedPanelId === activePanels.get(tool.id)
  }
</script>

<div class="toolbar" class:left={isLeft} class:right={!isLeft}>
  <div class="tools-section">
    <div
      class="quadrant-group"
      class:drag-over={ideStore.dragOverZone === topTarget}
      ondragover={(e) => handleDragOver(e, topTarget)}
      ondragleave={() => handleDragLeave(topTarget)}
      ondrop={() => handleDrop(topTarget)}
    >
      {#each topTools as tool (tool.id)}
        <button
          class="tool-button"
          class:active={isToolActive(tool)}
          class:focused={isToolFocused(tool)}
          class:dragging={ideStore.draggedTool?.id === tool.id}
          onclick={() => handleToolClick(tool)}
          title={tool.name}
          draggable="true"
          ondragstart={(e) => handleDragStart(e, tool)}
          ondragend={handleDragEnd}
        >
          <i class="icon">{tool.icon}</i>
        </button>
      {/each}
    </div>
    <div
      class="quadrant-group bottom"
      class:drag-over={ideStore.dragOverZone === bottomTarget}
      ondragover={(e) => handleDragOver(e, bottomTarget)}
      ondragleave={() => handleDragLeave(bottomTarget)}
      ondrop={() => handleDrop(bottomTarget)}
    >
      {#each bottomTools as tool (tool.id)}
        <button
          class="tool-button"
          class:active={isToolActive(tool)}
          class:focused={isToolFocused(tool)}
          class:dragging={ideStore.draggedTool?.id === tool.id}
          onclick={() => handleToolClick(tool)}
          title={tool.name}
          draggable="true"
          ondragstart={(e) => handleDragStart(e, tool)}
          ondragend={handleDragEnd}
        >
          <i class="icon">{tool.icon}</i>
        </button>
      {/each}
    </div>
  </div>

  {#if isLeft && sharedBottomTools.length > 0}
    <div class="bottom-section">
      {#each sharedBottomTools as tool (tool.id)}
        <button
          class="tool-button"
          class:active={isToolActive(tool)}
          class:focused={isToolFocused(tool)}
          onclick={() => handleToolClick(tool)}
          title={tool.name}
        >
          <i class="icon">{tool.icon}</i>
        </button>
      {/each}
    </div>
  {/if}
</div>

<style>
  .toolbar {
    width: 48px;
    background: #2d2d30;
    display: flex;
    flex-direction: column;
    padding: 0;
  }

  .toolbar.left {
    border-right: 1px solid #3e3e42;
  }

  .toolbar.right {
    border-left: 1px solid #3e3e42;
  }

  .tools-section {
    display: flex;
    flex-direction: column;
    padding: 8px 0;
    flex: 1;
  }

  .quadrant-group {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-height: 40px;
    transition: background-color 0.2s ease;
  }

  .quadrant-group.drag-over {
    background-color: #007acc;
  }

  .quadrant-group.bottom {
    margin-top: auto;
  }

  .bottom-section {
    display: flex;
    flex-direction: column;
    border-top: 1px solid #3e3e42;
    padding: 8px 0;
  }

  .tool-button {
    width: 32px;
    height: 32px;
    background: transparent;
    border: none;
    color: #cccccc;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
    margin: 2px 8px;
    border-radius: 3px;
    transition: opacity 0.2s ease;
  }

  .tool-button.dragging {
    opacity: 0.4;
  }

  .tool-button:hover {
    background: #3e3e42;
  }

  .tool-button.active {
    background: #3e3e42;
  }

  .tool-button.focused {
    background: #007acc;
    color: #ffffff;
  }

  .icon {
    font-size: 16px;
    font-style: normal;
  }
</style>
