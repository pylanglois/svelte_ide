<script>
  import { ideStore } from '@/stores/ideStore.svelte.js'
  import { eventBus } from '@/core/EventBusService.svelte.js'
  import FileViewer from '@tools/explorer/FileViewer.svelte'

  let metadata = $state(null)
  let activeTabId = $state(null)

  function processTab(tab) {
    if (tab && tab.component === FileViewer) {
      const fileContent = tab.fileContent || ''
      metadata = {
        name: tab.title,
        type: getFileExtension(tab.title),
        size: `${fileContent.length} octets`,
        modified: new Date().toLocaleDateString('fr-FR', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        }),
        encoding: 'UTF-8',
        lines: countLines(fileContent),
        characters: fileContent.length,
        words: fileContent.split(/\s+/).filter(Boolean).length
      }
      activeTabId = tab.id
    } else {
      metadata = null
      activeTabId = null
    }
  }

  $effect(() => {
    // 1. Traiter l'état initial au montage
    const currentActiveTab = ideStore.tabs.find(t => t.id === ideStore.activeTab)
    processTab(currentActiveTab)

    // 2. S'abonner aux futurs changements
    const unsubscribe = eventBus.subscribe('tabs:activated', (activatedTab) => {
      processTab(activatedTab)
    })

    // 3. Nettoyer l'abonnement à la destruction
    return () => unsubscribe()
  })

  function getFileExtension(filename) {
    if (!filename) return 'Inconnu'
    const extension = filename.split('.').pop()?.toLowerCase()
    switch (extension) {
      case 'svelte': return 'Composant Svelte'
      case 'js': return 'Fichier JavaScript'
      case 'ts': return 'Fichier TypeScript'
      case 'css': return 'Feuille de style CSS'
      case 'html': return 'Document HTML'
      case 'json': return 'Fichier JSON'
      case 'md': return 'Document Markdown'
      default: return 'Fichier texte'
    }
  }

  function countLines(content) {
    if (!content) return 0
    return content.split('\n').length
  }
</script>

<div class="metadata-panel">
  {#if metadata}
    <div class="metadata-section">
      <h4>Informations du fichier</h4>
      <div class="metadata-item">
        <span class="label">Nom:</span>
        <span class="value">{metadata.name}</span>
      </div>
      <div class="metadata-item">
        <span class="label">Type:</span>
        <span class="value">{metadata.type}</span>
      </div>
      <div class="metadata-item">
        <span class="label">Taille:</span>
        <span class="value">{metadata.size}</span>
      </div>
      <div class="metadata-item">
        <span class="label">Modifié:</span>
        <span class="value">{metadata.modified}</span>
      </div>
      <div class="metadata-item">
        <span class="label">Encodage:</span>
        <span class="value">{metadata.encoding}</span>
      </div>
    </div>

    <div class="metadata-section">
      <h4>Statistiques</h4>
      <div class="metadata-item">
        <span class="label">Lignes:</span>
        <span class="value">{metadata.lines}</span>
      </div>
      <div class="metadata-item">
        <span class="label">Mots:</span>
        <span class="value">{metadata.words}</span>
      </div>
      <div class="metadata-item">
        <span class="label">Caractères:</span>
        <span class="value">{metadata.characters}</span>
      </div>
    </div>
    
    <div class="metadata-section">
      <h4>Emplacement</h4>
      <div class="metadata-item">
        <span class="label">Onglet:</span>
        <span class="value">{activeTabId}</span>
      </div>
    </div>
  {:else}
    <div class="empty-state">
      <p>Aucun fichier sélectionné</p>
      <p class="hint">Ouvrez un fichier pour voir ses métadonnées</p>
    </div>
  {/if}
</div>

<style>
  .metadata-panel {
    height: 100%;
    padding: 8px;
  }

  .metadata-section {
    margin-bottom: 20px;
  }

  .metadata-section h4 {
    font-size: 13px;
    font-weight: 500;
    color: #cccccc;
    margin-bottom: 8px;
    padding-bottom: 4px;
    border-bottom: 1px solid #3e3e42;
  }

  .metadata-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 4px 0;
    font-size: 12px;
  }

  .label {
    color: #858585;
    min-width: 80px;
  }

  .value {
    color: #cccccc;
    text-align: right;
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .empty-state {
    text-align: center;
    padding: 20px;
    color: #858585;
  }

  .empty-state p {
    margin: 4px 0;
    font-size: 12px;
  }

  .hint {
    font-style: italic;
    opacity: 0.7;
  }
</style>
