<script>
  import { ideStore } from '@/stores/ideStore.svelte.js'

  let activeTab = $state(null)
  let metadata = $state(null)

  // Mise à jour réactive manuelle pour éviter les problèmes de $derived
  $effect(() => {
    activeTab = ideStore.tabs.find(tab => tab.id === ideStore.activeTab)
    
    if (activeTab && activeTab.id.startsWith('explorer-')) {
      const fileContent = activeTab.fileContent || 'allo bonjour'
      const lineCount = countLines(fileContent)
      
      metadata = {
        name: activeTab.title,
        type: getFileExtension(activeTab.title),
        size: generateFakeSize(),
        modified: new Date().toLocaleDateString('fr-FR', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        }),
        encoding: 'UTF-8',
        lines: lineCount,
        characters: fileContent.length,
        words: fileContent.split(/\s+/).filter(word => word.length > 0).length
      }
    } else {
      metadata = null
    }
  })

  function getFileExtension(filename) {
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

  function generateFakeSize() {
    // Génère une taille aléatoire mais cohérente pour le test
    const sizes = ['1.2 KB', '2.4 KB', '3.7 KB', '5.1 KB', '8.3 KB', '12.5 KB', '15.9 KB']
    return sizes[Math.floor(Math.random() * sizes.length)]
  }

  function countLines(content) {
    if (!content) return 0
    return content.split('\n').length
  }
</script>

<div class="metadata-panel">
  {#if activeTab && metadata}
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
        <span class="value">{activeTab.id}</span>
      </div>
      <div class="metadata-item">
        <span class="label">Statut:</span>
        <span class="value">{activeTab.isDirty ? 'Modifié' : 'Sauvegardé'}</span>
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