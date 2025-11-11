<script>
  import { onMount, tick } from 'svelte';
  import { eventBus, getAuthStore, ideStore, indexedDBService } from 'svelte-ide';
  import DocumentViewerTab from './DocumentViewerTab.svelte';
  import DocumentTreeNode from './DocumentTreeNode.svelte';
  import { TAB_PREFIX, TOOL_ICON, TOOL_ID, TOOL_NAME, VIEWER_RESOURCE_ID } from './constants.js';
  import { documentPersistenceService } from './documentPersistenceService.js';
  import {
      ChevronDownIcon,
      ChevronRightIcon,
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
    (import.meta.env.VITE_BACKEND_BASE_URL || 'https://bnr-exploia-np-ca-cvd-cae-001.proudplant-83adae51.canadaeast.azurecontainerapps.io').replace(/\/$/, '')
  const getBackendUrl = (path) => `${backendBaseUrl}${path}`

  const ROOT_ID = 'documents-root'
  const NODE_DRAG_TYPE = 'application/x-document-library-node'
  const CONTEXT_MENU_INITIAL = { visible: false, x: 0, y: 0, targetId: null, targetType: null }
  const FOLDER_DIALOG_INITIAL = { visible: false, parentId: null, name: '' }
  const MOVE_DIALOG_INITIAL = { visible: false, documentId: null, targetFolderId: ROOT_ID }

  let tree = $state(createRootFolder())
  let expandedFolders = $state({ [ROOT_ID]: true })
  let contextMenu = $state({ ...CONTEXT_MENU_INITIAL })
  let folderDialog = $state({ ...FOLDER_DIALOG_INITIAL })
  let moveDialog = $state({ ...MOVE_DIALOG_INITIAL })
  let draggedNodeId = $state(null)
  let draggedNodeType = $state(null)
  let dragOverFolderId = $state(null)
  let fileInputRef = $state(null)
  let folderDialogInputRef = $state(null)
  let isRestoring = $state(true)
  let hydrationInProgress = $state(false)

  let saveTreeTimeout = null
  let saveExpandedTimeout = null

  const folderOptions = $derived(buildFolderOptions(tree))

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

  function getSortedChildren(node) {
    if (!node?.children) return []
    return [...node.children].sort(compareNodes)
  }

  function generateDocumentId() {
    return `${TAB_PREFIX}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
  }

  function generateFolderId() {
    return `folder-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
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

  function buildFolderOptions(node, ancestors = []) {
    if (!node || node.nodeType !== 'folder') return []
    const path = [...ancestors, node.name]
    let options = [{ id: node.id, label: path.join(' / ') }]
    for (const child of getSortedChildren(node)) {
      if (child.nodeType === 'folder') {
        options = options.concat(buildFolderOptions(child, path))
      }
    }
    return options
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

  function toggleFolder(folderId) {
    expandedFolders = {
      ...expandedFolders,
      [folderId]: !expandedFolders[folderId]
    }
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

  function handleDrop(event) {
    event.preventDefault()
    event.stopPropagation()
    dragOverFolderId = null

    const files = event.dataTransfer?.files
    if (files && files.length > 0) {
      handleFiles(files)
    }
  }

  function handleDragOver(event) {
    const nodeDrag = isNodeDrag(event)
    const fileDrag = hasFilePayload(event)
    if (!nodeDrag && !fileDrag) return
    event.preventDefault()
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = nodeDrag ? 'move' : 'copy'
    }
    if (event.target === event.currentTarget) {
      dragOverFolderId = ROOT_ID
    }
  }

  function handleDragLeave(event) {
    if (event.target === event.currentTarget) {
      dragOverFolderId = null
    }
  }

  function handleFileInput(event) {
    const files = event.target?.files
    if (files && files.length > 0) {
      handleFiles(files)
      event.target.value = ''
    }
  }

  function openFileInput() {
    fileInputRef?.click()
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

  function deleteDocument(documentId) {
    if (!binaryPersister) {
      ideStore.addLog('Persistance non disponible', 'error', TOOL_NAME)
      return
    }

    let removedDocument = null
    updateTree(currentTree => {
      removedDocument = removeNodeById(currentTree, documentId)
    })

    if (!removedDocument) return
    const doc = /** @type {any} */ (removedDocument)
    if (doc.nodeType !== 'document') return

    binaryPersister.deleteBlob(doc.id).catch(error => {
      console.error(`Failed to delete blob ${doc.id}:`, error)
    })

    ideStore.addLog(`Document "${doc.name}" supprimé`, 'info', TOOL_NAME)
    removeDocument(documentId)
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

  function moveNode(nodeId, targetFolderId) {
    if (!nodeId || !targetFolderId) return
    const nodeToMove = findNodeById(tree, nodeId)
    if (!nodeToMove) return
    if (nodeToMove.id === ROOT_ID) return

    if (nodeToMove.nodeType === 'folder') {
      if (nodeToMove.parentId === targetFolderId) return
      if (targetFolderId === nodeToMove.id) return
      if (isAncestor(targetFolderId, nodeToMove.id)) return
    } else if (nodeToMove.parentId === targetFolderId) {
      return
    }

    let movedNode = null
    updateTree(currentTree => {
      movedNode = removeNodeById(currentTree, nodeId)
      if (!movedNode) return
      const targetFolder = findFolderById(currentTree, targetFolderId) ?? currentTree
      movedNode.parentId = targetFolder.id
      targetFolder.children = [...targetFolder.children, movedNode]
    })

    if (movedNode) {
      expandedFolders = { ...expandedFolders, [targetFolderId]: true }
      const node = /** @type {any} */ (movedNode)
      const label = node.nodeType === 'folder' ? 'Dossier' : 'Document'
      ideStore.addLog(`${label} "${node.name}" déplacé`, 'info', TOOL_NAME)
    }
  }

  function startFolderDialog(parentId) {
    closeContextMenu()
    folderDialog = { visible: true, parentId: parentId ?? ROOT_ID, name: '' }
    tick().then(() => {
      folderDialogInputRef?.focus()
      folderDialogInputRef?.select()
    })
  }

  function confirmFolderDialog() {
    if (!folderDialog.visible) return
    const name = folderDialog.name.trim()
    if (!name) return
    createFolder(folderDialog.parentId || ROOT_ID, name)
    folderDialog = { ...FOLDER_DIALOG_INITIAL }
  }

  function cancelFolderDialog() {
    folderDialog = { ...FOLDER_DIALOG_INITIAL }
  }

  function createFolder(parentId, name) {
    const newFolder = {
      id: generateFolderId(),
      name,
      nodeType: 'folder',
      parentId: parentId || ROOT_ID,
      children: []
    }

    updateTree(currentTree => {
      const parentFolder = findFolderById(currentTree, newFolder.parentId) ?? currentTree
      parentFolder.children = [...parentFolder.children, newFolder]
    })

    expandedFolders = {
      ...expandedFolders,
      [newFolder.parentId]: true,
      [newFolder.id]: true
    }

    ideStore.addLog(`Dossier "${name}" créé`, 'info', TOOL_NAME)
  }

  function startMoveDialog(documentId) {
    closeContextMenu()
    const doc = findNodeById(tree, documentId)
    moveDialog = {
      visible: true,
      documentId,
      targetFolderId: doc?.parentId || ROOT_ID
    }
  }

  function confirmMoveDialog() {
    if (!moveDialog.visible) return
    moveNode(moveDialog.documentId, moveDialog.targetFolderId)
    moveDialog = { ...MOVE_DIALOG_INITIAL }
  }

  function cancelMoveDialog() {
    moveDialog = { ...MOVE_DIALOG_INITIAL }
  }

  function openContextMenu(event, node) {
    event.preventDefault()
    event.stopPropagation()
    contextMenu = {
      visible: true,
      x: event.clientX,
      y: event.clientY,
      targetId: node.id,
      targetType: node.nodeType
    }
  }

  function handleBlankContextMenu(event) {
    if (event.target.closest('.item-content')) return
    openContextMenu(event, tree)
  }

  function closeContextMenu() {
    if (!contextMenu.visible) return
    contextMenu = { ...CONTEXT_MENU_INITIAL }
  }

  function isNodeDrag(event) {
    const types = event?.dataTransfer?.types
    if (!types) return false
    if (typeof types.includes === 'function') {
      return types.includes(NODE_DRAG_TYPE)
    }
    if (typeof types.contains === 'function') {
      return types.contains(NODE_DRAG_TYPE)
    }
    return Array.from(types).includes(NODE_DRAG_TYPE)
  }

  function hasFilePayload(event) {
    const dataTransfer = event?.dataTransfer
    if (!dataTransfer) return false
    if (dataTransfer.files && dataTransfer.files.length > 0) {
      return true
    }
    const types = dataTransfer.types
    if (!types) return false
    if (typeof types.includes === 'function') {
      return types.includes('Files')
    }
    if (typeof types.contains === 'function') {
      return types.contains('Files')
    }
    return Array.from(types).includes('Files')
  }

  function getTargetFolderId(folderId) {
    return folderId || ROOT_ID
  }

  function isLeavingDropZone(event) {
    const current = event?.currentTarget
    if (!current) return true
    const next = event?.relatedTarget
    if (!next) return true
    return !current.contains(next)
  }

  function getDragData(event) {
    const raw = event?.dataTransfer?.getData(NODE_DRAG_TYPE)
    if (raw) {
      try {
        return JSON.parse(raw)
      } catch (error) {
        // ignore invalid payload, fallback to local state
      }
    }
    if (draggedNodeId && draggedNodeType) {
      return { id: draggedNodeId, type: draggedNodeType }
    }
    return null
  }

  function handleNodeDragStart(event, node) {
    if (!node) return
    draggedNodeId = node.id
    draggedNodeType = node.nodeType
    dragOverFolderId = null
    if (event.dataTransfer) {
      event.dataTransfer.setData(NODE_DRAG_TYPE, JSON.stringify({ id: node.id, type: node.nodeType }))
      event.dataTransfer.effectAllowed = 'move'
    }
  }

  function handleNodeDragEnd() {
    draggedNodeId = null
    draggedNodeType = null
    dragOverFolderId = null
  }

  function handleFolderDragOver(event, folderId) {
    const targetFolderId = getTargetFolderId(folderId)
    if (isNodeDrag(event)) {
      const dragData = getDragData(event)
      if (!dragData) return
      if (dragData.id === targetFolderId) return
      if (dragData.type === 'folder' && isAncestor(targetFolderId, dragData.id)) return
      const draggedNode = findNodeById(tree, dragData.id)
      if (!draggedNode || draggedNode.parentId === targetFolderId) return
      event.preventDefault()
      event.stopPropagation()
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = 'move'
      }
      dragOverFolderId = targetFolderId
      return
    }

    if (hasFilePayload(event)) {
      event.preventDefault()
      event.stopPropagation()
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = 'copy'
      }
      dragOverFolderId = targetFolderId
    }
  }

  function handleFolderDrop(event, folderId) {
    const targetFolderId = getTargetFolderId(folderId)
    const nodeDrag = isNodeDrag(event)
    const fileDrag = hasFilePayload(event)
    if (!nodeDrag && !fileDrag) return
    event.preventDefault()
    event.stopPropagation()
    dragOverFolderId = null

    if (nodeDrag) {
      const dragData = getDragData(event)
      draggedNodeId = null
      draggedNodeType = null
      if (dragData?.id) {
        moveNode(dragData.id, targetFolderId)
      }
      return
    }

    const files = event.dataTransfer?.files
    if (files && files.length > 0) {
      handleFiles(files, targetFolderId)
    }
  }

  function handleFolderDragLeave(event, folderId) {
    const targetFolderId = getTargetFolderId(folderId)
    if (dragOverFolderId !== targetFolderId) return
    if (!isLeavingDropZone(event)) return
    if (isNodeDrag(event) || hasFilePayload(event)) {
      event.stopPropagation()
      dragOverFolderId = null
    }
  }

  onMount(async () => {
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

    await restoreData()

    const unsubscribeHydrationBefore = eventBus.subscribe('hydration:before', () => {
      hydrationInProgress = true
    })

    const unsubscribeHydrationAfter = eventBus.subscribe('hydration:after', async () => {
      hydrationInProgress = false
    })

    function handleWindowClick() {
      closeContextMenu()
    }

    function handleWindowKeydown(event) {
      if (event.key === 'Escape') {
        closeContextMenu()
      }
    }

    function resetGlobalDragState() {
      dragOverFolderId = null
    }

    function handleWindowDragEnd() {
      resetGlobalDragState()
    }

    function handleWindowDrop() {
      resetGlobalDragState()
    }

    window.addEventListener('click', handleWindowClick)
    window.addEventListener('keydown', handleWindowKeydown)
    window.addEventListener('dragend', handleWindowDragEnd)
    window.addEventListener('drop', handleWindowDrop)

    return () => {
      unsubscribeHydrationBefore()
      unsubscribeHydrationAfter()
      window.removeEventListener('click', handleWindowClick)
      window.removeEventListener('keydown', handleWindowKeydown)
      window.removeEventListener('dragend', handleWindowDragEnd)
      window.removeEventListener('drop', handleWindowDrop)
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
    <h2>DOCUMENTS</h2>
    <button type="button" class="action-btn" onclick={openFileInput} title="Ajouter">
      {@html UploadIcon({ size: 16 }).svg}
    </button>
  </header>

  <input
    bind:this={fileInputRef}
    type="file"
    multiple
    onchange={handleFileInput}
    style="display: none"
    aria-label="Sélectionner des fichiers"
  />

  <div
    class="content"
    ondrop={handleDrop}
    ondragover={handleDragOver}
    ondragleave={handleDragLeave}
    oncontextmenu={handleBlankContextMenu}
    role="region"
    aria-label="Zone de dépôt de fichiers"
  >
    <ul class="tree" role="tree">
      <DocumentTreeNode
        node={tree}
        depth={0}
        {expandedFolders}
        {dragOverFolderId}
        {draggedNodeId}
        {draggedNodeType}
        ROOT_ID={ROOT_ID}
        {getSortedChildren}
        {openDocument}
        {toggleFolder}
        {openContextMenu}
        {handleNodeDragStart}
        {handleNodeDragEnd}
        {handleFolderDragOver}
        {handleFolderDragLeave}
        {handleFolderDrop}
        {sendToBackend}
        {deleteDocument}
        {getFileIcon}
        UploadIcon={UploadIcon}
        Trash2Icon={Trash2Icon}
        FolderIcon={FolderIcon}
        ChevronDownIcon={ChevronDownIcon}
        ChevronRightIcon={ChevronRightIcon}
        isRoot={true}
      />
    </ul>

    {#if tree.children.length === 0}
      <div class="empty">
        <span class="empty-icon">{@html UploadIcon({ size: 20 }).svg}</span>
        <span class="empty-text">Déposez ou importez vos documents pour commencer</span>
      </div>
    {/if}
  </div>

  {#if contextMenu.visible}
    <div
      class="context-menu"
      role="menu"
      tabindex="-1"
      style={`top: ${contextMenu.y}px; left: ${contextMenu.x}px`}
      onclick={(event) => event.stopPropagation()}
      onkeydown={(event) => {
        event.stopPropagation()
        if (event.key === 'Escape') {
          closeContextMenu()
        }
      }}
    >
      {#if contextMenu.targetType === 'folder'}
        <button type="button" onclick={() => startFolderDialog(contextMenu.targetId)}>
          Nouveau dossier
        </button>
      {:else if contextMenu.targetType === 'document'}
        <button type="button" onclick={() => { openDocument(contextMenu.targetId); closeContextMenu() }}>
          Sélectionner
        </button>
        <button type="button" onclick={() => startMoveDialog(contextMenu.targetId)}>
          Déplacer vers…
        </button>
        <button type="button" class="danger" onclick={() => { deleteDocument(contextMenu.targetId); closeContextMenu() }}>
          Supprimer
        </button>
      {/if}
    </div>
  {/if}

  {#if folderDialog.visible}
    <div class="modal-backdrop" role="presentation">
      <form
        class="modal"
        onsubmit={(event) => {
          event.preventDefault()
          confirmFolderDialog()
        }}
      >
        <h3>Nouveau dossier</h3>
        <label>
          Nom du dossier
          <input
            bind:this={folderDialogInputRef}
            type="text"
            bind:value={folderDialog.name}
            placeholder="Nom"
            required
          />
        </label>
        <div class="modal-actions">
          <button type="button" class="secondary" onclick={cancelFolderDialog}>Annuler</button>
          <button type="submit">Créer</button>
        </div>
      </form>
    </div>
  {/if}

  {#if moveDialog.visible}
    {@const docToMove = findNodeById(tree, moveDialog.documentId)}
    <div class="modal-backdrop" role="presentation">
      <form
        class="modal"
        onsubmit={(event) => {
          event.preventDefault()
          confirmMoveDialog()
        }}
      >
        <h3>Déplacer « {docToMove?.name ?? 'Document'} »</h3>
        <label>
          Destination
          <select bind:value={moveDialog.targetFolderId}>
            {#each folderOptions as option}
              <option value={option.id}>{option.label}</option>
            {/each}
          </select>
        </label>
        <div class="modal-actions">
          <button type="button" class="secondary" onclick={cancelMoveDialog}>Annuler</button>
          <button type="submit">Déplacer</button>
        </div>
      </form>
    </div>
  {/if}
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

  .content {
    flex: 1;
    overflow-y: auto;
    min-height: 0;
    position: relative;
    display: flex;
    flex-direction: column;
  }

  .tree {
    list-style: none;
    margin: 0;
    padding: 6px 0 12px 0;
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 100%;
  }

  :global(.tree-item) {
    list-style: none;
    min-height: 22px;
  }

  :global(.tree-item.root) {
    flex: 1;
    display: flex;
    flex-direction: column;
  }

  :global(.tree-item.root > .tree-node) {
    flex: 1;
    min-height: 100%;
    display: flex;
    flex-direction: column;
  }

  :global(.tree-item.root > .tree-node > .tree-children) {
    flex: 1;
    display: flex;
    flex-direction: column;
  }

  :global(.tree-node) {
    position: relative;
  }

  :global(.tree-item.folder.drag-over > .tree-node::after) {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: 6px;
    border: 1px dashed #007acc;
    background: rgba(14, 99, 156, 0.12);
    pointer-events: none;
  }

  :global(.tree-item.folder.drag-over > .tree-node > .item-content) {
    background: rgba(14, 99, 156, 0.35);
  }

  :global(.tree-item.dragging-document > .tree-node > .item-content),
  :global(.tree-item.dragging-folder > .tree-node > .item-content) {
    opacity: 0.6;
  }

  :global(.tree-children) {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  :global(.item-content) {
    display: flex;
    align-items: center;
    gap: 4px;
    height: 22px;
    padding: 0 8px;
    cursor: pointer;
    position: relative;
    border-radius: 4px;
  }

  :global(.item-content:hover) {
    background: #2a2d2e;
  }

  :global(.item-content:focus) {
    outline: none;
    background: #094771;
  }

  :global(.twisty) {
    width: 18px;
    height: 18px;
    border: none;
    background: transparent;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #858585;
    cursor: pointer;
    flex-shrink: 0;
    padding: 0;
  }

  :global(.twisty.placeholder) {
    width: 18px;
    height: 18px;
    display: inline-flex;
  }

  :global(.item-icon) {
    display: flex;
    align-items: center;
    flex-shrink: 0;
    color: #c5c5c5;
  }

  :global(.item-icon svg) {
    display: block;
  }

  :global(.item-label) {
    flex: 1;
    font-size: 13px;
    color: #cccccc;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    min-width: 0;
  }

  :global(.item-action) {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 18px;
    padding: 0;
    border: none;
    background: transparent;
    color: #858585;
    cursor: pointer;
    border-radius: 3px;
    flex-shrink: 0;
  }

  :global(.item-action:hover) {
    background: #5a1d1d;
    color: #f48771;
  }

  .empty {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px;
    color: #6a6a6a;
    font-size: 12px;
    border-top: 1px solid #2e2e2e;
    margin: 0 8px;
  }

  .empty-icon {
    display: flex;
    opacity: 0.5;
  }

  .empty-text {
    font-style: italic;
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

  .modal-backdrop {
    position: absolute;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 30;
  }

  .modal {
    background: #1e1e1e;
    border: 1px solid #3e3e42;
    border-radius: 8px;
    padding: 16px;
    width: 280px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .modal h3 {
    margin: 0;
    font-size: 15px;
    color: #ffffff;
  }

  .modal label {
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 12px;
    color: #cccccc;
  }

  .modal input,
  .modal select {
    padding: 6px 8px;
    border-radius: 4px;
    border: 1px solid #3e3e42;
    background: #252526;
    color: #ffffff;
    font-size: 13px;
  }

  .modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }

  .modal-actions button {
    border: none;
    border-radius: 4px;
    padding: 6px 12px;
    font-size: 13px;
    cursor: pointer;
  }

  .modal-actions .secondary {
    background: transparent;
    color: #cccccc;
    border: 1px solid #3e3e42;
  }

  .modal-actions button[type='submit'] {
    background: #0e639c;
    color: #ffffff;
  }
</style>
