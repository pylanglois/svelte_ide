<script>
  import { onMount } from 'svelte';
  import { eventBus, getAuthStore, ideStore, indexedDBService } from 'svelte-ide';
  import GenericElementTree from '@/components/ui/generic-element-tree/GenericElementTree.svelte';
  import DocumentViewerTab from './DocumentViewerTab.svelte';
  import { TAB_PREFIX, TOOL_ICON, TOOL_ID, TOOL_NAME, VIEWER_RESOURCE_ID } from './constants.js';
  import { documentPersistenceService } from './documentPersistenceService.js';
  import {
      FileIcon,
      FileSpreadsheetIcon,
      FileTextIcon,
      FolderIcon,
      ImageIcon,
      Trash2Icon,
      UploadIcon
  } from './icons.js';
  import { getActiveDocumentId, removeDocument, setActiveDocument, setBackendResponse } from './stores/documentViewerStore.svelte.js';

  let { panelId } = $props()

  let binaryPersister = $state(null)
  let treePersister = $state(null)
  let backendResponsesPersister = $state(null)
  let metaPersister = $state(null)
  const VIEWER_TAB_ID = `${TAB_PREFIX}-viewer`

  const backendBaseUrl =
    (import.meta.env.VITE_BACKEND_BASE_URL || 'http://localhost:5173').replace(/\/$/, '')
  const getBackendUrl = (path) => `${backendBaseUrl}${path}`

  const ROOT_ID = 'documents-root'
  const HEADER_MENU_INITIAL = { visible: false, x: 0, y: 0 }
  const STORAGE_NAMESPACES = ['documents', 'document-library-tree', 'document-backend-responses', 'document-library-meta']

  let tree = $state(createRootFolder())
  let expandedFolders = $state({ [ROOT_ID]: true })
  let headerMenu = $state({ ...HEADER_MENU_INITIAL })
  let isRestoring = $state(true)
  let hydrationInProgress = $state(false)
  let manualHydrationDepth = 0
  let globalHydrationActive = false
  let rehydratePromise = null

  let saveTreeTimeout = null
  let saveExpandedTimeout = null

  function createRootFolder() {
    return {
      id: ROOT_ID,
      name: 'DOCUMENTS',
      nodeType: 'folder',
      parentId: null,
      children: []
    }
  }

  function compareNodes(a, b) {
    if (!a || !b) return 0
    if (a.nodeType === b.nodeType) {
      return a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' })
    }
    return a.nodeType === 'folder' ? -1 : 1
  }

  function generateDocumentId() {
    return `${TAB_PREFIX}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
  }

  function updateTree(mutator) {
    mutator(tree)
    tree = { ...tree }
    saveTreeDebounced()
  }

  function findNodeById(node, id) {
    if (!node) return null
    if (node.id === id) return node
    if (node.nodeType !== 'folder') return null
    for (const child of node.children) {
      const found = findNodeById(child, id)
      if (found) return found
    }
    return null
  }

  function findFolderById(node, id) {
    if (!node) return null
    if (node.id === id && node.nodeType === 'folder') return node
    if (node.nodeType !== 'folder') return null
    for (const child of node.children) {
      const found = findFolderById(child, id)
      if (found) return found
    }
    return null
  }

  function isAncestor(nodeId, potentialAncestorId) {
    if (!nodeId || !potentialAncestorId) return false
    let current = findNodeById(tree, nodeId)
    while (current && current.parentId) {
      if (current.parentId === potentialAncestorId) {
        return true
      }
      current = findNodeById(tree, current.parentId)
    }
    return false
  }

  function removeNodeById(node, id) {
    if (!node || node.nodeType !== 'folder') return null
    const index = node.children.findIndex(child => child.id === id)
    if (index !== -1) {
      return node.children.splice(index, 1)[0]
    }
    for (const child of node.children) {
      if (child.nodeType === 'folder') {
        const removed = removeNodeById(child, id)
        if (removed) {
          return removed
        }
      }
    }
    return null
  }

  function shouldHandleStorageImport(namespaces) {
    if (!Array.isArray(namespaces)) {
      return false
    }
    return namespaces.some(namespace => STORAGE_NAMESPACES.includes(namespace))
  }

  function updateHydrationState() {
    hydrationInProgress = globalHydrationActive || manualHydrationDepth > 0
  }

  function enterManualHydration() {
    manualHydrationDepth += 1
    updateHydrationState()
  }

  function leaveManualHydration() {
    if (manualHydrationDepth > 0) {
      manualHydrationDepth -= 1
    }
    updateHydrationState()
  }

  function getFileIcon(fileName, mimeType) {
    const ext = fileName.split('.').pop()?.toLowerCase()

    if (ext === 'pdf' || mimeType === 'application/pdf') {
      return FileTextIcon
    }
    if (['docx', 'doc'].includes(ext) || mimeType?.includes('word')) {
      return FileTextIcon
    }
    if (['xlsx', 'xls'].includes(ext) || mimeType?.includes('spreadsheet')) {
      return FileSpreadsheetIcon
    }
    if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'].includes(ext) || mimeType?.startsWith('image/')) {
      return ImageIcon
    }
    return FileIcon
  }

  function buildTreeContextMenu(node, helpers) {
    if (!node || !helpers) return []
    const items = []
    if (node.nodeType === 'folder') {
      items.push({
        id: 'new-folder',
        label: 'Nouveau dossier',
        action: () => helpers.startFolderDialog(node.id)
      })
    }
    if (node.nodeType === 'document') {
      items.push(
        {
          id: 'open',
          label: 'Sélectionner',
          action: () => openDocument(node.id)
        },
        {
          id: 'move',
          label: 'Déplacer vers…',
          action: () => helpers.startMoveDialog(node.id)
        },
        {
          id: 'delete',
          label: 'Supprimer',
          danger: true,
          action: () => helpers.deleteNode(node.id)
        }
      )
    }
    return items
  }

  function buildInlineActions(node) {
    if (!node || node.nodeType !== 'document') return []
    return [
      {
        id: 'send-backend',
        icon: UploadIcon({ size: 12 }).svg,
        title: 'Envoyer au backend',
        ariaLabel: `Envoyer ${node.name} au backend`,
        run: () => sendToBackend(node.id)
      },
      {
        id: 'delete-document',
        icon: Trash2Icon({ size: 12 }).svg,
        title: 'Supprimer',
        ariaLabel: `Supprimer ${node.name}`,
        danger: true,
        run: ({ helpers }) => helpers.deleteNode(node.id)
      }
    ]
  }

  function resolveNodeIconForTree(node, meta = {}) {
    if (meta.isFolder) {
      return FolderIcon({ size: 14 })
    }
    const iconFactory = getFileIcon(node?.name ?? '', node?.type ?? '')
    return iconFactory({ size: 14 })
  }

  function handleNodeOpen(node) {
    if (!node || node.nodeType !== 'document') return
    openDocument(node.id)
  }

  function handleTreeChange(event) {
    if (!event?.tree) return
    tree = event.tree
    saveTreeDebounced()

    if (event.reason === 'folder-created') {
      if (event.node?.name) {
        ideStore.addLog(`Dossier "${event.node.name}" créé`, 'info', TOOL_NAME)
      }
      return
    }

    if (event.reason === 'node-moved' && event.node) {
      const label = event.node.nodeType === 'folder' ? 'Dossier' : 'Document'
      ideStore.addLog(`${label} "${event.node.name}" déplacé`, 'info', TOOL_NAME)
      return
    }

    if (event.reason === 'node-deleted') {
      handleNodeDeleted(event.node)
    }
  }

  function handleNodeDeleted(node) {
    if (!node) return
    if (node.nodeType !== 'document') return

    if (binaryPersister) {
      binaryPersister.deleteBlob(node.id).catch(error => {
        console.error(`Failed to delete blob ${node.id}:`, error)
      })
    }

    ideStore.addLog(`Document "${node.name}" supprimé`, 'info', TOOL_NAME)
    removeDocument(node.id)
  }

  function handleFilesSelected({ files, targetFolderId }) {
    if (!files || files.length === 0) return
    handleFiles(files, targetFolderId || ROOT_ID)
  }

  function handleExpandedFoldersChange(payload) {
    if (!payload?.expandedState) return
    expandedFolders = { ...payload.expandedState }
    saveExpandedFoldersDebounced()
  }

  async function saveTree() {
    if (isRestoring || hydrationInProgress || !treePersister) return
    try {
      await treePersister.save('tree', tree)
    } catch (error) {
      console.error('Failed to save tree:', error)
    }
  }

  async function saveExpandedFolders() {
    if (isRestoring || hydrationInProgress || !treePersister) return
    try {
      await treePersister.save('expandedFolders', expandedFolders)
    } catch (error) {
      console.error('Failed to save expanded folders:', error)
    }
  }

  function saveTreeDebounced() {
    if (saveTreeTimeout) clearTimeout(saveTreeTimeout)
    saveTreeTimeout = setTimeout(saveTree, 500)
  }

  function saveExpandedFoldersDebounced() {
    if (saveExpandedTimeout) clearTimeout(saveExpandedTimeout)
    saveExpandedTimeout = setTimeout(saveExpandedFolders, 500)
  }

  async function handleFiles(files, targetFolderId = ROOT_ID) {
    if (!files?.length) return

    if (!binaryPersister) {
      console.warn('Binary persister not available, data will be temporary')
    }

    const newDocuments = Array.from(files).map(file => ({
      id: generateDocumentId(),
      nodeType: 'document',
      name: file.name,
      type: file.type,
      size: file.size,
      uploadedAt: new Date(),
      parentId: targetFolderId,
      file
    }))

    for (const doc of newDocuments) {
      try {
        await binaryPersister.saveBlob(doc.id, doc.file, {
          filename: doc.name,
          mimeType: doc.type,
          tags: doc.parentId ? [doc.parentId] : [],
          custom: {
            parentId: doc.parentId,
            uploadedAt: doc.uploadedAt.toISOString(),
            nodeType: 'document'
          }
        })
      } catch (error) {
        console.error(`Failed to save blob ${doc.id}:`, error)
        ideStore.addLog(`Erreur lors de la sauvegarde de "${doc.name}"`, 'error', TOOL_NAME)
      }
    }

    updateTree(currentTree => {
      const folder = findFolderById(currentTree, targetFolderId) ?? currentTree
      folder.children = [...folder.children, ...newDocuments]
    })

    expandedFolders = { ...expandedFolders, [targetFolderId]: true }

    ideStore.addLog(
      `${newDocuments.length} document(s) ajouté(s) à la bibliothèque`,
      'info',
      TOOL_NAME
    )
  }

  async function openDocument(documentId) {
    const doc = findNodeById(tree, documentId)
    if (!doc || doc.nodeType !== 'document') return

    let backendResponse = null
    if (backendResponsesPersister) {
      try {
        const responses = (await backendResponsesPersister.load('responses')) || {}
        backendResponse = responses[documentId]?.backendResponse || null
      } catch (error) {
        console.error('Failed to load backend response:', error)
      }
    }

    setActiveDocument(doc, backendResponse)

    let tab = ideStore.getTabById(VIEWER_TAB_ID)

    if (!tab) {
      tab = {
        id: VIEWER_TAB_ID,
        title: 'JSON Viewer',
        component: DocumentViewerTab,
        closable: true,
        icon: TOOL_ICON,
        descriptor: {
          type: 'document-viewer',
          toolId: TOOL_ID,
          resourceId: VIEWER_RESOURCE_ID,
          icon: TOOL_ICON
        },
        toolId: TOOL_ID,
        componentProps: {}
      }
      ideStore.addTab(tab)
    }

    ideStore.setActiveTab(VIEWER_TAB_ID)
    ideStore.addLog(`Document "${doc.name}" affiché dans le viewer`, 'info', TOOL_NAME)
  }

  async function sendToBackend(documentId) {
    if (!binaryPersister || !backendResponsesPersister) {
      ideStore.addLog('Persistance non disponible', 'error', TOOL_NAME)
      return
    }

    const doc = findNodeById(tree, documentId)
    if (!doc || doc.nodeType !== 'document') return

    try {
      const blobData = await binaryPersister.loadBlob(documentId)
      if (!blobData?.data) {
        ideStore.addLog(`Erreur : fichier "${doc.name}" introuvable`, 'error', TOOL_NAME)
        return
      }

      const authStore = getAuthStore()
      const token = authStore.getAccessToken('access_as_user')
      
      if (!token) {
        ideStore.addLog('Aucun token d\'authentification disponible. Connectez-vous d\'abord.', 'warning', TOOL_NAME)
        return
      }

      const formData = new FormData()
      formData.append('file', blobData.data, doc.name)

      const response = await fetch(getBackendUrl('/api/v1/file-json'), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const result = await response.json()
      
      const backendResponses = await backendResponsesPersister.load('responses') || {}
      backendResponses[documentId] = {
        filename: result.filename,
        backendResponse: result,
        backendResponseTime: new Date().toISOString(),
        status: 'success',
        attempts: (backendResponses[documentId]?.attempts || 0) + 1
      }
      await backendResponsesPersister.save('responses', backendResponses)
      setBackendResponse(documentId, result)
      
      ideStore.addLog(`Fichier "${result.filename}" envoyé (${result.size} octets)`, 'info', TOOL_NAME)
    } catch (error) {
      console.error('Failed to send file to backend:', error)
      
      const backendResponses = await backendResponsesPersister.load('responses') || {}
      backendResponses[documentId] = {
        filename: doc.name,
        error: error.message,
        errorTime: new Date().toISOString(),
        status: 'error',
        attempts: (backendResponses[documentId]?.attempts || 0) + 1
      }
      await backendResponsesPersister.save('responses', backendResponses)
      
      ideStore.addLog(`Erreur envoi "${doc.name}" : ${error.message}`, 'error', TOOL_NAME)
    }
  }

  function toggleHeaderMenu(event) {
    event.preventDefault()
    event.stopPropagation()
    if (headerMenu.visible) {
      closeHeaderMenu()
      return
    }
    const rect = event.currentTarget.getBoundingClientRect()
    headerMenu = {
      visible: true,
      x: rect.left,
      y: rect.bottom + 4
    }
  }

  function closeHeaderMenu() {
    if (!headerMenu.visible) return
    headerMenu = { ...HEADER_MENU_INITIAL }
  }

  function handleAlloAction() {
    ideStore.addLog('allo', 'info', 'Core')
    closeHeaderMenu()
  }

  async function restoreFilesFromBlobs(treeNode) {
    if (!treeNode) return

    if (treeNode.nodeType === 'document' && treeNode.id) {
      try {
        const blobData = await binaryPersister.loadBlob(treeNode.id)
        if (blobData?.data) {
          treeNode.file = blobData.data
          treeNode.name = blobData.filename || treeNode.name
          treeNode.type = blobData.mimeType || treeNode.type
          treeNode.size = blobData.size || treeNode.size
          if (blobData.custom?.uploadedAt) {
            treeNode.uploadedAt = new Date(blobData.custom.uploadedAt)
          }
        }
      } catch (error) {
        console.error(`Failed to restore blob ${treeNode.id}:`, error)
      }
    }

    if (treeNode.children) {
      for (const child of treeNode.children) {
        await restoreFilesFromBlobs(child)
      }
    }
  }

  async function restoreData() {
    try {
      if (!treePersister || !binaryPersister) {
        throw new Error('DocumentLibrary: persistence service is not initialized')
      }

      const savedTree = await treePersister.load('tree')
      const savedExpanded = await treePersister.load('expandedFolders')

      if (savedTree) {
        await restoreFilesFromBlobs(savedTree)
        tree = savedTree
      }

      if (savedExpanded) {
        expandedFolders = savedExpanded
      }

      if (metaPersister) {
        const meta = await metaPersister.load('meta')
        if (meta?.activeDocumentId) {
          const doc = findNodeById(tree, meta.activeDocumentId)
          if (doc && doc.nodeType === 'document') {
            let backendResponse = null
            if (backendResponsesPersister) {
              try {
                const responses = (await backendResponsesPersister.load('responses')) || {}
                backendResponse = responses[meta.activeDocumentId]?.backendResponse || null
              } catch (error) {
                console.error('Failed to load backend response:', error)
              }
            }
            setActiveDocument(doc, backendResponse)
          }
        }
      }

      ideStore.addLog('Documents restaurés', 'info', TOOL_NAME)
    } catch (error) {
      console.warn('Failed to restore documents, continuing with empty tree', error)
    } finally {
      isRestoring = false
      eventBus.publish('document-library:state-restored', {
        hasRestoredContent: tree.children.length > 0
      })
    }
  }

  function rehydrateFromStorage() {
    if (!binaryPersister || !treePersister) {
      return Promise.resolve()
    }
    if (rehydratePromise) {
      return rehydratePromise
    }
    rehydratePromise = (async () => {
      isRestoring = true
      enterManualHydration()
      try {
        await restoreData()
      } finally {
        leaveManualHydration()
        rehydratePromise = null
      }
    })()
    return rehydratePromise
  }

  onMount(async () => {
    try {
      await indexedDBService.readyForEncryption({ timeoutMs: 8000 })
    } catch (error) {
      console.error('DocumentLibrary: encrypted persistence unavailable', error)
      ideStore.addLog('Persistance indisponible pour la bibliothèque de documents', 'error', TOOL_NAME)
      throw error
    }

    binaryPersister = documentPersistenceService.getBinaryPersister()
    treePersister = documentPersistenceService.getTreePersister()
    backendResponsesPersister = documentPersistenceService.getBackendResponsesPersister()
    metaPersister = documentPersistenceService.getMetaPersister()

    await rehydrateFromStorage()

    const unsubscribeHydrationBefore = eventBus.subscribe('hydration:before', () => {
      globalHydrationActive = true
      updateHydrationState()
    })

    const unsubscribeHydrationAfter = eventBus.subscribe('hydration:after', () => {
      globalHydrationActive = false
      updateHydrationState()
    })

    const unsubscribeStorageImported = eventBus.subscribe('storage:imported', payload => {
      if (!shouldHandleStorageImport(payload?.namespaces)) {
        return
      }
      void rehydrateFromStorage()
    })

    function handleWindowClick() {
      closeHeaderMenu()
    }

    function handleWindowKeydown(event) {
      if (event.key === 'Escape') {
        closeHeaderMenu()
      }
    }

    window.addEventListener('click', handleWindowClick)
    window.addEventListener('keydown', handleWindowKeydown)

    return () => {
      unsubscribeHydrationBefore()
      unsubscribeHydrationAfter()
      unsubscribeStorageImported()
      window.removeEventListener('click', handleWindowClick)
      window.removeEventListener('keydown', handleWindowKeydown)
    }
  })

  $effect(() => {
    if (!metaPersister || isRestoring) return

    const currentActiveId = getActiveDocumentId()
    if (!currentActiveId) return

    metaPersister.save('meta', { activeDocumentId: currentActiveId }).catch(error => {
      console.error('Failed to save activeDocumentId:', error)
    })
  })
</script>

<section
  class="panel-root"
  data-panel-id={panelId}
  aria-label="Bibliothèque de documents"
>
  <header>
    <h2>BIBLIOTHÈQUE</h2>
    <button
      type="button"
      class="action-btn"
      onclick={toggleHeaderMenu}
      aria-haspopup="true"
      aria-expanded={headerMenu.visible}
      aria-label="Ouvrir les options"
      title="Options"
    >
      ...
    </button>
  </header>

  {#if headerMenu.visible}
    <div
      class="context-menu"
      role="menu"
      tabindex="-1"
      style={`top: ${headerMenu.y}px; left: ${headerMenu.x}px`}
      onclick={(event) => event.stopPropagation()}
      onkeydown={(event) => {
        event.stopPropagation()
        if (event.key === 'Escape') {
          closeHeaderMenu()
        }
      }}
    >
      <button type="button" role="menuitem" onclick={handleAlloAction}>
        allo
      </button>
    </div>
  {/if}
  <GenericElementTree
    {panelId}
    title="BIBLIOTHÈQUE"
    rootName="DOCUMENTS"
    initialTree={tree}
    initialExpandedState={expandedFolders}
    allowFolderCreation={true}
    allowNodeDrag={true}
    allowExternalFileDrop={true}
    showUploadHint={true}
    showHeader={false}
    uploadHintText="Déposez ou importez vos documents pour commencer"
    autoAppendDroppedFiles={false}
    contextMenuBuilder={buildTreeContextMenu}
    inlineActionsBuilder={buildInlineActions}
    resolveNodeIcon={resolveNodeIconForTree}
    onTreeChange={handleTreeChange}
    onNodeOpen={handleNodeOpen}
    onFilesSelected={handleFilesSelected}
    onExpandedFoldersChange={handleExpandedFoldersChange}
    sortComparer={compareNodes}
  />
</section>

<style>
  .panel-root {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: #252526;
    color: #cccccc;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 13px;
    position: relative;
  }

  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 8px;
    height: 22px;
    flex-shrink: 0;
  }

  h2 {
    margin: 0;
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: #cccccc;
  }

  .action-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    padding: 0;
    border: none;
    background: transparent;
    color: #c5c5c5;
    cursor: pointer;
    border-radius: 3px;
    opacity: 0.6;
  }

  .action-btn:hover {
    background: #2a2d2e;
    opacity: 1;
  }

  .context-menu {
    position: fixed;
    background: #1e1e1e;
    border: 1px solid #3e3e42;
    border-radius: 4px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
    padding: 4px 0;
    z-index: 20;
    min-width: 180px;
  }

  .context-menu button {
    width: 100%;
    background: none;
    border: none;
    color: #cccccc;
    text-align: left;
    padding: 6px 12px;
    font-size: 13px;
    cursor: pointer;
  }

  .context-menu button:hover {
    background: #094771;
  }

  .context-menu button.danger {
    color: #f48771;
  }
</style>
