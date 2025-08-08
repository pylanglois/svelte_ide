<script>
  import { ideStore } from '@/stores/ideStore.svelte.js'
  import ExplorerPanel from '@/components/panels/ExplorerPanel.svelte'
  
  let { position } = $props()
  
  let newPanels = $state([])
  let loadedComponents = $state(new Map())
  let panelsManager = null
  let callbackAttached = false

  // Initialisation manuelle sans $effect
  function initializePanel() {
    if (!panelsManager && ideStore.legacyAdapter?.panelsManager) {
      panelsManager = ideStore.legacyAdapter.panelsManager
      panelsManager.addChangeCallback(updatePanels)
      callbackAttached = true
      updatePanels()
    }
  }

  // Surveiller la disponibilité du panelsManager
  $effect(() => {
    if (ideStore.legacyAdapter?.panelsManager && !callbackAttached) {
      initializePanel()
    }
  })
  
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
  
  // Fonction pour mettre à jour les panneaux (sans effect)
  async function updatePanels() {
    const panelsManager = ideStore.legacyAdapter?.panelsManager
    if (!panelsManager) return
    
    const activePanels = Array.from(panelsManager.activePanelsByPosition.entries())
      .filter(([pos, panel]) => pos === position && panel !== null)
      .map(([pos, panel]) => panel)
    
    // Charger les composants nécessaires
    for (const panel of activePanels) {
      if (!loadedComponents.has(panel.id)) {
        // Déterminer le bon composant basé sur l'ID du panel (nouveau pattern)
        let componentName = 'ExplorerPanel' // défaut
        
        if (panel.id.startsWith('tool-') || panel.id.startsWith('calculator-')) {
          // Identifier via les métadonnées du panneau
          const title = panel.title?.toLowerCase() || ''
          if (title.includes('calculatrice')) {
            componentName = 'CalculatorPanel'
          } else if (title.includes('v2')) {
            componentName = 'Explorer2Panel'
          } else if (title.includes('explorateur')) {
            componentName = 'ExplorerPanel'
          }
        } else if (panel.id.startsWith('console-')) {
          // Console système - utiliser le composant déjà défini
          if (panel.component) {
            loadedComponents.set(panel.id, panel.component)
            continue
          }
        }
        
        const component = await loadComponent(componentName)
        if (component) {
          loadedComponents.set(panel.id, component)
        }
      }
    }
    
    newPanels = activePanels
  }
  

</script>

<!-- Nouveau système uniquement -->
{#if newPanels.length > 0}
  <div class="new-panels-integrated">
    {#each newPanels as panel (panel.id)}
      <div class="new-panel-wrapper" data-panel-id={panel.id}>
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
  .new-panels-integrated {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--panel-bg, #252526);
  }
  
  .new-panel-wrapper {
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
