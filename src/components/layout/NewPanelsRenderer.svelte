<script>
  import { ideStore } from '@/stores/ideStore.svelte.js'
  import ExplorerPanel from '@/components/panels/ExplorerPanel.svelte'
  
  let activePanels = $state([])
  let panelsManager = null
  
  // Fonction pour charger les composants dynamiquement
  async function loadComponent(componentName) {
    try {
      switch (componentName) {
        case 'CalculatorPanel':
          const { default: CalculatorPanel } = await import('@tools/calculator/CalculatorPanel.svelte')
          return CalculatorPanel
        case 'Explorer2Panel':
          const { default: Explorer2Panel } = await import('@tools/explorer2/Explorer2Panel.svelte')
          return Explorer2Panel
        case 'ExplorerPanel':
        default:
          return ExplorerPanel
      }
    } catch (error) {
      console.error('Erreur chargement composant:', componentName, error)
      return null
    }
  }
  
  $effect(() => {
    panelsManager = ideStore.legacyAdapter?.panelsManager
    if (panelsManager) {
      // Fonction callback pour la réactivité
      const updatePanels = () => {
        activePanels = Array.from(panelsManager.activePanelsByPosition.entries())
          .filter(([position, panel]) => panel !== null)
          .map(([position, panel]) => ({ position, panel }))
      }
      
      // S'abonner aux changements
      panelsManager.addChangeCallback(updatePanels)
      
      // Initialiser
      updatePanels()
      
      // Cleanup
      return () => {
        panelsManager.removeChangeCallback(updatePanels)
      }
    }
  })
</script>

{#if activePanels.length > 0}
  <div class="new-panels-integrated">
    {#each activePanels as { position, panel } (panel.id)}
      <div 
        class="panel-container {position}" 
        data-panel-id={panel.id}
        data-position={position}
      >
        {#if panel.id === 'explorer-new'}
          <ExplorerPanel panelId={panel.id} toolId={panel.toolId} />
        {:else if panel.id === 'calculator-new'}
          {#await loadComponent('CalculatorPanel') then CalculatorComponent}
            {#if CalculatorComponent}
              <svelte:component this={CalculatorComponent} panelId={panel.id} />
            {/if}
          {/await}
        {:else if panel.id === 'explorer2-new'}
          {#await loadComponent('Explorer2Panel') then Explorer2Component}
            {#if Explorer2Component}
              <svelte:component this={Explorer2Component} panelId={panel.id} />
            {/if}
          {/await}
        {:else}
          <div class="panel-placeholder">
            <div class="panel-header">
              <span>{panel.icon} {panel.title}</span>
            </div>
            <div class="panel-content">
              <p>Panneau {panel.title} activé</p>
              <button onclick={() => panelsManager.deactivatePanel(panel.id)}>
                Fermer
              </button>
            </div>
          </div>
        {/if}
      </div>
    {/each}
  </div>
{/if}

<style>
  .new-panels-container {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    pointer-events: none;
    z-index: 1000;
  }
  
  .panel-zone {
    position: absolute;
    pointer-events: auto;
    min-width: 200px;
    min-height: 150px;
    background: var(--panel-bg, #1e1e1e);
    border: 1px solid var(--panel-border, #404040);
    border-radius: 4px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  }
  
  .panel-zone.topLeft {
    top: 80px;
    left: 20px;
    width: 300px;
    height: 400px;
  }
  
  .panel-zone.bottomLeft {
    bottom: 20px;
    left: 20px;
    width: 300px;
    height: 200px;
  }
  
  .panel-zone.topRight {
    top: 80px;
    right: 20px;
    width: 300px;
    height: 400px;
  }
  
  .panel-zone.bottomRight {
    bottom: 20px;
    right: 20px;
    width: 300px;
    height: 200px;
  }
  
  .panel-zone.bottom {
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%);
    width: 600px;
    height: 200px;
  }
  
  .panel-placeholder {
    height: 100%;
    display: flex;
    flex-direction: column;
  }
  
  .panel-placeholder .panel-header {
    padding: 8px 12px;
    background: var(--panel-header-bg, #2d2d30);
    border-bottom: 1px solid var(--panel-border, #404040);
    font-size: 12px;
    color: var(--text-color, #cccccc);
  }
  
  .panel-placeholder .panel-content {
    flex: 1;
    padding: 12px;
    color: var(--text-color, #cccccc);
  }
  
  .panel-placeholder button {
    background: var(--button-bg, #0078d4);
    color: white;
    border: none;
    padding: 6px 12px;
    border-radius: 3px;
    cursor: pointer;
    margin-top: 8px;
  }
  
  .panel-placeholder button:hover {
    background: var(--button-hover-bg, #106ebe);
  }
</style>
