<script>
  import { ideStore } from '@/stores/ideStore.svelte.js'
  import { eventBus } from '@/core/EventBusService.svelte.js'
  import { layoutService } from '@/core/LayoutService.svelte.js'
  import FileViewer from '@tools/explorer2/FileViewer.svelte'

  let metadata = $state(null)

  function processTab(tab) {
    if (tab && tab.component === FileViewer) {
      const fileContent = tab.fileContent || ''
      const fileName = tab.title.replace('V2: ', '')
      metadata = {
        fileName: fileName,
        fileType: getFileExtension(fileName),
        fileSize: `${fileContent.length} octets`,
        lines: countLines(fileContent),
        words: fileContent.split(/\s+/).filter(Boolean).length,
        characters: fileContent.length
      }
    } else {
      metadata = null
    }
  }

  $effect(() => {
    // Réagir aux changements du focus global
    const currentActiveTab = layoutService.activeTab
    processTab(currentActiveTab)
  })

  $effect(() => {
    // S'abonner aux événements de changement de tab
    const unsubscribe = eventBus.subscribe('tabs:activated', (activatedTab) => {
      processTab(activatedTab)
    })

    // Nettoyer l'abonnement à la destruction
    return () => unsubscribe()
  })

  function getFileExtension(fileName) {
    if (!fileName) return 'Inconnu'
    const ext = fileName.split('.').pop()
    const types = {
      'js': 'JavaScript',
      'css': 'Feuille de style',
      'txt': 'Texte',
      'jpg': 'Image JPEG',
      'json': 'JSON'
    }
    return types[ext] || 'Fichier'
  }

  function countLines(content) {
    if (!content) return 0
    return content.split('\n').length
  }
</script>

<div class="metadata-panel">
  {#if metadata}
    <div class="metadata-section">
      <h4>🔍 Infos V2</h4>
      <div class="metadata-item">
        <span class="label">Fichier :</span>
        <span class="value">{metadata.fileName}</span>
      </div>
      <div class="metadata-item">
        <span class="label">Type :</span>
        <span class="value">{metadata.fileType}</span>
      </div>
      <div class="metadata-item">
        <span class="label">Taille :</span>
        <span class="value">{metadata.fileSize}</span>
      </div>
    </div>

    <div class="metadata-section">
      <h4>📊 Statistiques V2</h4>
      <div class="metadata-item">
        <span class="label">Lignes :</span>
        <span class="value">{metadata.lines}</span>
      </div>
      <div class="metadata-item">
        <span class="label">Mots :</span>
        <span class="value">{metadata.words}</span>
      </div>
      <div class="metadata-item">
        <span class="label">Caractères :</span>
        <span class="value">{metadata.characters}</span>
      </div>
    </div>
  {:else}
    <div class="empty-state">
      <p>🔍 Métadonnées V2</p>
      <p>Aucun fichier V2 sélectionné</p>
    </div>
  {/if}
</div>

<style>
  .metadata-panel {
    padding: 12px;
    font-size: 13px;
    height: 100%;
    overflow-y: auto;
  }

  .metadata-section {
    margin-bottom: 16px;
  }

  .metadata-section h4 {
    margin: 0 0 8px 0;
    font-size: 12px;
    font-weight: 600;
    color: #569cd6;
    border-bottom: 1px solid #3e3e42;
    padding-bottom: 4px;
  }

  .metadata-item {
    display: flex;
    justify-content: space-between;
    margin-bottom: 6px;
    padding: 2px 0;
  }

  .label {
    color: #9cdcfe;
    font-weight: 500;
  }

  .value {
    color: #d4d4d4;
    text-align: right;
  }

  .empty-state {
    text-align: center;
    color: #858585;
    margin-top: 40px;
  }

  .empty-state p {
    margin: 8px 0;
  }

  .empty-state p:first-child {
    font-size: 14px;
    font-weight: 600;
  }
</style>
