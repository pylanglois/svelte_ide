<script>
  import { ideStore } from '@/stores/ideStore.svelte.js'

  let { position } = $props()

  const isLeft = position === 'left'

  let topTools = $state([])
  let bottomTools = $state([])
  let sharedBottomTools = $state([])
  
  $effect(() => {
    topTools = isLeft ? ideStore.topLeftTools : ideStore.topRightTools
    bottomTools = isLeft ? ideStore.bottomLeftTools : ideStore.bottomRightTools
    sharedBottomTools = isLeft ? ideStore.bottomTools : []
  })

  const topTarget = isLeft ? 'topLeft' : 'topRight'
  const bottomTarget = isLeft ? 'bottomLeft' : 'bottomRight'

  function handleToolClick(tool) {
    // Utiliser directement le PanelsManager avec l'ID pré-enregistré
    activateToolInNewSystem(tool)
  }

  async function activateToolInNewSystem(tool) {
    
    try {
      const panelsManager = ideStore.panelsManager
      if (!panelsManager) {
        console.error('PanelsManager non disponible')
        return
      }
      
      // L'outil est déjà enregistré par ToolManager, on l'active juste
      let panelId = `tool-${tool.id}`
      
      // Cas spéciaux pour les outils système
      if (tool.name === 'Console') {
        panelId = `console-${tool.id}`
      }
      
      const success = panelsManager.activatePanel(panelId, tool.component)
      
      if (!success) {
        console.warn(`⚠️ Échec activation ${tool.name}`)
      }
      
    } catch (error) {
      console.error('❌ Erreur activation outil:', error)
    }
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
          class:active={tool.active}
          class:focused={tool.active && ideStore.focusedPanel === tool.position}
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
          class:active={tool.active}
          class:focused={tool.active && ideStore.focusedPanel === tool.position}
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
          class:active={tool.active}
          class:focused={tool.active && ideStore.focusedPanel === tool.position}
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
    min-height: 40px; /* Zone de drop minimale */
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
