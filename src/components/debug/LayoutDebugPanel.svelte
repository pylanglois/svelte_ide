<script>
  import { ideStore } from '@/stores/ideStore.svelte.js'
  
  let systemStatus = $state({})
  let showDebug = $state(false)
  
  $effect(() => {
    systemStatus = ideStore.getLayoutSystemStatus()
  })
  
  function toggleNewSystem() {
    if (ideStore.isNewLayoutSystemEnabled()) {
      ideStore.disableNewLayoutSystem()
    } else {
      ideStore.enableNewLayoutSystem()
    }
  }
  
  function toggleDebugPanel() {
    showDebug = !showDebug
  }
  
  function testLayoutSystem() {
    const result = ideStore.testNewLayoutSystem()
    console.log('Test result:', result)
  }
  
  function migrateExplorer() {
    const result = ideStore.migrateExplorerToNewSystem()
    console.log('Migration explorer result:', result)
  }
  
  async function migrateCalculator() {
    const result = await ideStore.migrateCalculatorToNewSystem()
    console.log('Migration calculator result:', result)
  }
  
  async function migrateExplorer2() {
    const result = await ideStore.migrateExplorer2ToNewSystem()
    console.log('Migration explorer2 result:', result)
  }
  
  async function migrateAllTools() {
    const result = await ideStore.migrateAllToolsToNewSystem()
    console.log('Migration complète result:', result)
  }
  
  function closeAllNewPanels() {
    const result = ideStore.closeAllNewPanels()
    console.log('Fermeture de tous les panneaux:', result)
  }
  
  function showSystemPanels() {
    const panels = ideStore.getNewSystemPanels()
    console.log('Panneaux du nouveau système:', panels)
  }
</script>

<div class="layout-debug">
  <button class="debug-toggle" onclick={toggleDebugPanel}>
    🔧 Debug Layout
  </button>
  
  {#if showDebug}
    <div class="debug-panel">
      <h3>Système de Layout</h3>
      
      <div class="status-section">
        <p><strong>Mode actuel :</strong> 
          {systemStatus.isNewSystemEnabled ? '🆕 Nouveau système' : '🔄 Système legacy'}
        </p>
        
        <button class="toggle-btn" onclick={toggleNewSystem}>
          {systemStatus.isNewSystemEnabled ? 'Revenir au legacy' : 'Activer nouveau système'}
        </button>
        
        <button class="test-btn" onclick={testLayoutSystem}>
          🧪 Tester le nouveau système
        </button>
        
        <button class="migrate-btn" onclick={migrateExplorer}>
          🔄 Migrer Explorer
        </button>
        
        <button class="migrate-btn" onclick={migrateCalculator}>
          🧮 Migrer Calculator
        </button>
        
        <button class="migrate-btn" onclick={migrateExplorer2}>
          🗂️ Migrer Explorer V2
        </button>
        
        <button class="migrate-btn all" onclick={migrateAllTools}>
          🚀 MIGRER TOUT
        </button>
      </div>
      
      <div class="management-section">
        <h4>Gestion des Panneaux</h4>
        <button class="management-btn close" onclick={closeAllNewPanels}>
          ❌ Fermer Tous
        </button>
        
        <button class="management-btn info" onclick={showSystemPanels}>
          📋 Liste Panneaux
        </button>
      </div>
      
      <div class="stats-section">
        <h4>Statistiques</h4>
        <ul>
          <li>Zones enregistrées : {systemStatus.registeredZones || 0}</li>
          <li>Panneaux actifs : {systemStatus.activePanels || 0}</li>
          <li>Onglets : {systemStatus.totalTabs || 0}</li>
        </ul>
      </div>
      
      <div class="preferences-section">
        <h4>Préférences</h4>
        <ul>
          <li>Barre de statut : {ideStore.preferences.getEffectivePreference('ide.showStatusBar') ? '✅' : '❌'}</li>
          <li>Barre d'outils : {ideStore.preferences.getEffectivePreference('ide.showToolbar') ? '✅' : '❌'}</li>
          <li>Sauvegarde auto : {ideStore.preferences.getEffectivePreference('ide.autoSave') ? '✅' : '❌'}</li>
        </ul>
      </div>
    </div>
  {/if}
</div>

<style>
  .layout-debug {
    position: fixed;
    top: 10px;
    right: 10px;
    z-index: 9999;
  }
  
  .debug-toggle {
    background: #333;
    color: white;
    border: none;
    padding: 8px 12px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 12px;
  }
  
  .debug-toggle:hover {
    background: #555;
  }
  
  .debug-panel {
    position: absolute;
    top: 100%;
    right: 0;
    width: 300px;
    background: white;
    border: 1px solid #ccc;
    border-radius: 4px;
    padding: 16px;
    margin-top: 4px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.1);
    font-size: 12px;
  }
  
  .debug-panel h3 {
    margin: 0 0 12px 0;
    font-size: 14px;
    color: #333;
  }
  
  .debug-panel h4 {
    margin: 12px 0 6px 0;
    font-size: 12px;
    color: #666;
  }
  
  .status-section {
    margin-bottom: 12px;
    padding-bottom: 12px;
    border-bottom: 1px solid #eee;
  }
  
  .toggle-btn {
    background: #007acc;
    color: white;
    border: none;
    padding: 6px 12px;
    border-radius: 3px;
    cursor: pointer;
    font-size: 11px;
    margin-top: 6px;
    margin-right: 6px;
  }
  
  .test-btn {
    background: #28a745;
    color: white;
    border: none;
    padding: 6px 12px;
    border-radius: 3px;
    cursor: pointer;
    font-size: 11px;
    margin-top: 6px;
  }
  
  .toggle-btn:hover {
    background: #005a9e;
  }
  
  .test-btn:hover {
    background: #1e7e34;
  }
  
  .migrate-btn {
    background: #ff8c00;
    color: white;
    border: none;
    padding: 6px 12px;
    border-radius: 3px;
    cursor: pointer;
    font-size: 11px;
    margin-top: 6px;
    margin-left: 6px;
  }
  
  .migrate-btn:hover {
    background: #e67300;
  }
  
  .migrate-btn.all {
    background: #28a745;
    font-weight: bold;
    margin-left: 8px;
  }
  
  .migrate-btn.all:hover {
    background: #1e7e34;
  }
  
  .management-section {
    margin-top: 12px;
    padding-top: 12px;
    border-top: 1px solid #eee;
  }
  
  .management-btn {
    border: none;
    padding: 6px 12px;
    border-radius: 3px;
    cursor: pointer;
    font-size: 11px;
    margin-top: 6px;
    margin-right: 6px;
  }
  
  .management-btn.close {
    background: #dc3545;
    color: white;
  }
  
  .management-btn.close:hover {
    background: #c82333;
  }
  
  .management-btn.info {
    background: #17a2b8;
    color: white;
  }
  
  .management-btn.info:hover {
    background: #138496;
  }
  
  .stats-section ul,
  .preferences-section ul {
    margin: 6px 0;
    padding-left: 16px;
  }
  
  .stats-section li,
  .preferences-section li {
    margin: 3px 0;
    color: #666;
  }
</style>
