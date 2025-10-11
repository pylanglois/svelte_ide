<script>
  import { ideStore } from '@/stores/ideStore.svelte.js'
  
  let { position } = $props()
  let activePanels = $state([])
  let loadedComponents = $state(new Map())
  let subscribedManager = null

  function getToolsForPosition() {
    switch (position) {
      case 'topLeft':
        return ideStore.topLeftTools
      case 'bottomLeft':
        return ideStore.bottomLeftTools
      case 'topRight':
        return ideStore.topRightTools
      case 'bottomRight':
        return ideStore.bottomRightTools
      case 'bottom':
        return ideStore.bottomTools
      default:
        return []
    }
  }

  function updatePanels() {
    const manager = ideStore.panelsManager
    if (!manager) {
      activePanels = []
      return
    }

    const tools = getToolsForPosition() || []
    const nextPanels = []

    for (const tool of tools) {
      if (!tool || !tool.panelId) continue
      const panel = manager.getPanel(tool.panelId)
      if (!panel || !panel.isActive) continue
      if (panel.component && loadedComponents.get(panel.id) !== panel.component) {
        loadedComponents.set(panel.id, panel.component)
      }
      nextPanels.push(panel)
    }

    const activeIds = new Set(nextPanels.map(panel => panel.id))
    for (const [panelId] of loadedComponents) {
      if (!activeIds.has(panelId)) {
        loadedComponents.delete(panelId)
      }
    }

    activePanels = nextPanels
  }

  function handleManagerChange() {
    updatePanels()
  }

  $effect(() => {
    const manager = ideStore.panelsManager

    if (manager === subscribedManager) {
      return
    }

    if (subscribedManager) {
      subscribedManager.removeChangeCallback(handleManagerChange)
      subscribedManager = null
    }

    if (!manager) {
      activePanels = []
      return
    }

    subscribedManager = manager
    subscribedManager.addChangeCallback(handleManagerChange)
    updatePanels()

    return () => {
      if (subscribedManager) {
        subscribedManager.removeChangeCallback(handleManagerChange)
        subscribedManager = null
      }
    }
  })

  $effect(() => {
    const tools = getToolsForPosition()
    tools.length
    updatePanels()
  })
</script>
{#if activePanels.length > 0}
  <div class="tool-panels-container">
    {#each activePanels as panel (panel.id)}
      <div class="panel-wrapper" data-panel-id={panel.id}>
        {#if loadedComponents.has(panel.id)}
          {@const PanelComponent = loadedComponents.get(panel.id)}
          <div class="component-wrapper">
            <PanelComponent panelId={panel.id} />
          </div>
        {:else}
          <div class="panel-loading">
            <div class="panel-header">
              <span>{panel.icon} {panel.title}</span>
            </div>
            <div class="panel-content">
              <p>Chargement...</p>
            </div>
          </div>
        {/if}
      </div>
    {/each}
  </div>
{/if}

<style>
  .tool-panels-container {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--panel-bg, #252526);
  }
  
  .panel-wrapper {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
  }
  
  .component-wrapper {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
  }
  
  .panel-loading {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--panel-bg, #252526);
    border: 1px solid var(--panel-border, #3c3c3c);
  }
  
  .panel-loading .panel-header {
    background: var(--panel-header-bg, #2d2d30);
    border-bottom: 1px solid var(--panel-border, #3c3c3c);
    padding: 8px 12px;
    font-size: 12px;
    color: var(--text-color, #cccccc);
  }
  
  .panel-loading .panel-content {
    flex: 1;
    padding: 12px;
    color: var(--text-color, #cccccc);
    display: flex;
    align-items: center;
    justify-content: center;
  }
</style>
