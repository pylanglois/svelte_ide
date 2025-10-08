<script>
  import { ideStore } from '@/stores/ideStore.svelte.js'
  import FileViewer from '@tools/explorer2/FileViewer.svelte'
  import { contextMenuService } from '@/core/ContextMenuService.svelte.js'

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
    ideStore.addLog(`Fichier ${file.name} sélectionné`, 'info', 'Explorateur V2')
  }

  function handleFileDoubleClick(file) {
    ideStore.openFile({
      fileName: `V2: ${file.name}`,
      content: file.content || 'Contenu par défaut V2',
      component: FileViewer,
      icon: getIconForFile(file.name),
      toolId: toolId
    })
    
    ideStore.addLog(`Fichier ${file.name} ouvert`, 'info', 'Explorateur V2')
    
    ideStore.addNotification(
      'Fichier ouvert (V2)',
      `Le fichier "${file.name}" a été ouvert depuis l'Explorateur V2`,
      'success',
      'Explorateur V2'
    )
  }

  function handleFolderClick(folder) {
    selectedFileName = folder.name
    ideStore.addLog(`Dossier ${folder.name} sélectionné`, 'info', 'Explorateur V2')
  }

  function handleContextMenu(e, item) {
    e.preventDefault()
    
    const menuItems = [
      {
        id: 'hello-v2',
        label: 'Hello V2',
        icon: '🚀',
        action: (context) => {
          ideStore.addLog(`Hello V2 action sur ${context.name}`, 'info', 'Menu contextuel V2')
        }
      },
      {
        id: 'separator1',
        separator: true
      },
      {
        id: 'inspect',
        label: 'Inspecter',
        icon: '🔍',
        action: (context) => {
          ideStore.addNotification(
            'Inspection',
            `Inspection de ${context.name} depuis l'Explorateur V2`,
            'info',
            'Explorateur V2'
          )
        }
      },
      {
        id: 'open-v2',
        label: 'Ouvrir (V2)',
        icon: '📂',
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
    <button class="refresh-btn" title="Actualiser V2">
      🔄
    </button>
    <button class="new-folder-btn" title="Nouveau dossier V2">
      🗂️+
    </button>
    <button class="new-file-btn" title="Nouveau fichier V2">
      🗒️+
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
            <span class="icon">🗂️</span>
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
            <span class="icon">🗒️</span>
            <span class="name">{item.name}</span>
          </div>
        {/if}
      {/each}
    {:else}
      <div class="empty-state">
        <p>Aucun fichier à afficher (V2)</p>
        <p class="hint">Explorateur V2 vide</p>
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