<script>
  import { ideStore } from '@/stores/ideStore.svelte.js'
  import ExplorerPanel from '@/components/panels/ExplorerPanel.svelte'
  
  let { position } = $props()
  
  let newPanels = $state([])
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
  
  let loadedComponents = $state(new Map())
  
  $effect(() => {
    panelsManager = ideStore.legacyAdapter?.panelsManager
    if (panelsManager) {
      const updateNewPanels = async () => {
        const activePanels = Array.from(panelsManager.activePanelsByPosition.entries())
          .filter(([pos, panel]) => pos === position && panel !== null)
          .map(([pos, panel]) => panel)
        
        // Charger les composants nécessaires
        for (const panel of activePanels) {
          if (!loadedComponents.has(panel.id)) {
            // Déterminer le bon composant basé sur l'ID du panel
            let componentName = 'ExplorerPanel' // défaut
            if (panel.id === 'calculator-new') {
              componentName = 'CalculatorPanel'
            } else if (panel.id === 'explorer2-new') {
              componentName = 'Explorer2Panel'
            } else if (panel.id === 'explorer-new') {
              componentName = 'ExplorerPanel'
            }
            
            const component = await loadComponent(componentName)
            if (component) {
              loadedComponents.set(panel.id, component)
            }
          }
        }
        
        newPanels = activePanels
      }
      
      panelsManager.addChangeCallback(updateNewPanels)
      updateNewPanels()
      
      return () => {
        panelsManager.removeChangeCallback(updateNewPanels)
      }
    }
  })
</script>

<!-- Nouveau système uniquement -->
{#if newPanels.length > 0}
  <div class="new-panels-integrated">
    {#each newPanels as panel (panel.id)}
      <div class="new-panel-wrapper" data-panel-id={panel.id}>
        {#if loadedComponents.has(panel.id)}
          {@const PanelComponent = loadedComponents.get(panel.id)}
          <PanelComponent panelId={panel.id} />
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
{:else}
  <!-- Message quand aucun panel -->
  <div class="empty-zone">
    <p>Zone {position} - Nouveau système actif</p>
  </div>
{/if}

<style>
  .new-panels-integrated {
    /* S'intègre parfaitement dans la zone ToolPanel */
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--panel-bg, #252526);
  }
  
  .new-panel-wrapper {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0; /* Important pour le scroll */
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
  
  .empty-zone {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: var(--text-color, #666666);
    font-size: 12px;
    font-style: italic;
  }
</style>
