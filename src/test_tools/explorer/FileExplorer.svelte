<script>
  import { ideStore } from '@/stores/ideStore.svelte.js'
  import FileViewer from '@tools/explorer/FileViewer.svelte'
  import { contextMenuService } from '@/core/ContextMenuService.svelte.js'
  import { openFileInIDE } from './fileService.svelte.js'

  let { files = [], toolId } = $props()
  let selectedFileName = $state(null)

  function getIconForFile(fileName) {
    const extension = fileName.split('.').pop()
    switch (extension) {
      case 'js': return 'JS'
      case 'html': return '🌐'
      case 'css': return '🎨'
      case 'json': return '{}'
      case 'md': return '📝'
      default: return '📄'
    }
  }

  function handleFileClick(file) {
    selectedFileName = file.name
    ideStore.addLog(`Fichier ${file.name} sélectionné`, 'info', 'Explorateur')
  }

  function handleFileDoubleClick(file) {
    // Utiliser la fonction partagée
    openFileInIDE(file.name, ideStore, FileViewer)
    
    ideStore.addLog(`Fichier ${file.name} ouvert`, 'info', 'Explorateur')
    
    ideStore.addNotification(
      'Fichier ouvert',
      `Le fichier "${file.name}" a été ouvert dans l'éditeur`,
      'success',
      'Explorateur'
    )
  }

  function handleFolderClick(folder) {
    selectedFileName = folder.name
    ideStore.addLog(`Dossier ${folder.name} sélectionné`, 'info', 'Explorateur')
  }

  function handleContextMenu(e, item) {
    e.preventDefault()
    
    const menuItems = [
      {
        id: 'hello',
        label: 'Hello',
        icon: '👋',
        action: (context) => {
          ideStore.addLog(`Hello action sur ${context.name}`, 'info', 'Menu contextuel')
        }
      },
      {
        id: 'separator1',
        separator: true
      },
      {
        id: 'open',
        label: 'Ouvrir',
        icon: '📄',
        action: (context) => {
          if (context.type === 'file') {
            handleFileDoubleClick(context)
          }
        },
        disabled: item.type !== 'file'
      }
    ]

    contextMenuService.show(e.clientX, e.clientY, item, menuItems)
  }
</script>

<div class="file-explorer">
  <div class="toolbar">
    <button class="refresh-btn" title="Actualiser">
      🔄
    </button>
    <button class="new-folder-btn" title="Nouveau dossier">
      📁+
    </button>
    <button class="new-file-btn" title="Nouveau fichier">
      📄+
    </button>
  </div>
  
  <div class="file-tree">
    {#if files.length > 0}
      {#each files as item}
        {#if item.type === 'folder'}
          <div 
            class="folder-item" 
            class:selected={selectedFileName === item.name} 
            data-context-menu
            onclick={() => handleFolderClick(item)}
            oncontextmenu={(e) => handleContextMenu(e, item)}
          >
            <span class="icon">📁</span>
            <span class="name">{item.name}</span>
          </div>
        {:else}
          <div 
            class="file-item" 
            class:selected={selectedFileName === item.name} 
            data-context-menu
            onclick={() => handleFileClick(item)} 
            ondblclick={() => handleFileDoubleClick(item)}
            oncontextmenu={(e) => handleContextMenu(e, item)}
          >
            <span class="icon">📄</span>
            <span class="name">{item.name}</span>
          </div>
        {/if}
      {/each}
    {:else}
      <div class="empty-state">
        <p>Aucun fichier à afficher</p>
        <p class="hint">Connectez-vous à un projet</p>
      </div>
    {/if}
  </div>
</div>

<style>
  .file-explorer {
    height: 100%;
    display: flex;
    flex-direction: column;
    user-select: none;
  }

  .toolbar {
    display: flex;
    gap: 4px;
    padding: 8px;
    border-bottom: 1px solid #3e3e42;
  }

  .toolbar button {
    background: transparent;
    border: 1px solid #3e3e42;
    color: #cccccc;
    padding: 4px 8px;
    border-radius: 3px;
    cursor: pointer;
    font-size: 12px;
  }

  .toolbar button:hover {
    background: #3e3e42;
  }

  .file-tree {
    flex: 1;
    overflow-y: auto;
    padding: 4px 0;
  }

  .folder-item, .file-item {
    display: flex;
    align-items: center;
    padding: 4px 12px;
    cursor: pointer;
    font-size: 13px;
  }

  .folder-item:hover, .file-item:hover {
    background: #3e3e42;
  }

  .folder-item.selected, .file-item.selected {
    background: #094771;
    color: #ffffff;
  }

  .icon {
    margin-right: 8px;
    font-size: 14px;
  }

  .name {
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