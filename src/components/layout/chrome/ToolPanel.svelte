<script>
  import { ideStore } from '@/stores/ideStore.svelte.js'
  
  let { position } = $props()
  
  let activePanels = $state([])
  let loadedComponents = $state(new Map())
  let panelsManager = null
  let callbackAttached = false

  // Initialisation manuelle sans $effect
  function initializePanel() {
    if (!panelsManager && ideStore.panelsManager) {
      panelsManager = ideStore.panelsManager
      panelsManager.addChangeCallback(updatePanels)
      callbackAttached = true
      updatePanels()
    }
  }

  // Surveiller la disponibilité du panelsManager
  $effect(() => {
    if (ideStore.panelsManager && !callbackAttached) {
      initializePanel()
    }
  })
  
  // Fonction pour mettre à jour les panneaux (sans effect)
  async function updatePanels() {
    const panelsManager = ideStore.panelsManager
    if (!panelsManager) return
    
    const panelsList = Array.from(panelsManager.activePanelsByPosition.entries())
      .filter(([pos, panel]) => pos === position && panel !== null)
      .map(([pos, panel]) => panel)
    
    // Charger les composants fournis par les outils eux-mêmes
    for (const panel of panelsList) {
      if (!loadedComponents.has(panel.id) && panel.component) {
        loadedComponents.set(panel.id, panel.component)
      }
    }
    
    activePanels = panelsList
  }
  

</script>

<!-- Nouveau système uniquement -->
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
