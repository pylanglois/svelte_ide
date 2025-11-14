<script>
  import { onMount, tick } from 'svelte';
  import ElementTreeNode from './ElementTreeNode.svelte';
  import { FileIcon, FolderIcon, UploadIcon } from './icons.js';
  import { createLogger } from '@/lib/logger.js';

  const NODE_DRAG_TYPE = 'application/x-generic-element-tree-node'
  const CONTEXT_MENU_INITIAL = { visible: false, x: 0, y: 0, items: [] }
  const FOLDER_DIALOG_INITIAL = { visible: false, parentId: null, name: '' }
  const MOVE_DIALOG_INITIAL = { visible: false, nodeId: null, targetFolderId: null }
  const noop = () => {}

  function defaultCompareNodes(a, b) {
    if (!a || !b) return 0
    const aFolder = isFolderNode(a)
    const bFolder = isFolderNode(b)
    if (aFolder && !bFolder) return -1
    if (!aFolder && bFolder) return 1
    return (a?.name ?? '').localeCompare(b?.name ?? '', 'fr', { sensitivity: 'base' })
  }

  function generateNodeId(prefix = 'node') {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
  }

  function cloneNode(node) {
    if (!node) return null
    const cloned = { ...node }
    if (Array.isArray(node.children)) {
      cloned.children = node.children.map(child => cloneNode(child))
    } else {
      cloned.children = []
    }
    return cloned
  }

  function isFolderNode(node) {
    const kind = node?.nodeType ?? node?.kind ?? node?.type
    return kind === 'folder'
  }

  function findNodeById(node, id) {
    if (!node) return null
    if (node.id === id) return node
    if (!isFolderNode(node)) return null
    for (const child of node.children) {
      const found = findNodeById(child, id)
      if (found) return found
    }
    return null
  }

  function findFolderById(node, id) {
    if (!node) return null
    if (!id) return node
    if (node.id === id && isFolderNode(node)) return node
    if (!isFolderNode(node)) return null
    for (const child of node.children) {
      const found = findFolderById(child, id)
      if (found) return found
    }
    return null
  }

  function removeNodeById(node, id) {
    if (!node || !isFolderNode(node)) return null
    const index = node.children.findIndex(child => child.id === id)
    if (index !== -1) {
      return node.children.splice(index, 1)[0]
    }
    for (const child of node.children) {
      if (isFolderNode(child)) {
        const removed = removeNodeById(child, id)
        if (removed) return removed
      }
    }
    return null
  }

  function isAncestor(tree, nodeId, ancestorId) {
    if (!tree || !nodeId || !ancestorId) return false
    let current = findNodeById(tree, nodeId)
    while (current && current.parentId) {
      if (current.parentId === ancestorId) return true
      current = findNodeById(tree, current.parentId)
    }
    return false
  }

  function buildFolderOptions(node, ancestors = []) {
    if (!node || !isFolderNode(node)) return []
    const path = [...ancestors, node.name ?? '']
    let options = [{ id: node.id, label: path.join(' / ') }]
    for (const child of node.children) {
      if (isFolderNode(child)) {
        options = options.concat(buildFolderOptions(child, path))
      }
    }
    return options
  }

  function createRootNode(name) {
    return {
      id: generateNodeId('root'),
      name,
      nodeType: 'folder',
      parentId: null,
      children: []
    }
  }

  function defaultIconResolver(node, meta = {}) {
    if (meta.isFolder) {
      return FolderIcon({ size: 14 })
    }
    return FileIcon({ size: 14 })
  }

  function defaultContextMenuBuilder(node, helpers) {
    if (!node || !helpers) return []
    const items = []
    if (helpers.isFolder(node) && helpers.config.allowFolderCreation) {
      items.push({
        id: 'new-folder',
        label: 'Nouveau dossier',
        action: () => helpers.startFolderDialog(node.id)
      })
    }
    if (!helpers.isFolder(node)) {
      items.push({
        id: 'select',
        label: 'Sélectionner',
        action: () => helpers.selectNode(node)
      })
    }
    if (!helpers.isFolder(node) && helpers.config.allowNodeDrag) {
      items.push({
        id: 'move',
        label: 'Déplacer vers…',
        action: () => helpers.startMoveDialog(node.id)
      })
    }
    items.push({
      id: 'delete',
      label: 'Supprimer',
      danger: true,
      action: () => helpers.deleteNode(node.id)
    })
    return items
  }

  function normalizeTree(source, fallbackName) {
    if (!source) {
      return createRootNode(fallbackName)
    }
    const base = cloneNode(source)
    base.id = base.id ?? generateNodeId('root')
    base.nodeType = 'folder'
    base.children = Array.isArray(base.children) ? base.children : []
    base.parentId = null
    return base
  }

  let {
    panelId = null,
    title = 'BIBLIOTHÈQUE',
    rootName = 'DOCUMENTS',
    initialTree = null,
    initialExpandedState = null,
    allowFolderCreation = true,
    allowNodeDrag = true,
    allowExternalFileDrop = true,
    showUploadHint = true,
    showHeader = true,
    uploadHintText = 'Déposez ou importez vos éléments pour commencer',
    autoAppendDroppedFiles = true,
    contextMenuBuilder: contextMenuBuilderProp = null,
    inlineActionsBuilder: inlineActionsBuilderProp = null,
    resolveNodeIcon: resolveNodeIconProp = null,
    onNodeSelect = noop,
    onNodeOpen = noop,
    onTreeChange = noop,
    onFilesSelected = noop,
    onExpandedFoldersChange = noop,
    sortComparer = null
  } = $props()

  const resolvedContextMenuBuilder = contextMenuBuilderProp ?? defaultContextMenuBuilder
  const resolvedInlineActionsBuilder = inlineActionsBuilderProp ?? (() => [])
  const iconResolver = (node, meta) => (resolveNodeIconProp ? resolveNodeIconProp(node, meta) : defaultIconResolver(node, meta))
  const compareNodes = sortComparer ?? defaultCompareNodes

  let hasInitializedExternalTree = false
  let tree = $state(normalizeTree(initialTree, rootName))
  let expandedFolders = $state(initialExpandedState ? { ...initialExpandedState } : { [tree.id]: true })
  let contextMenu = $state({ ...CONTEXT_MENU_INITIAL })
  let folderDialog = $state({ ...FOLDER_DIALOG_INITIAL })
  let moveDialog = $state({ ...MOVE_DIALOG_INITIAL })
  let dragOverFolderId = $state(null)
  let draggedNodeId = $state(null)
  let draggedNodeType = $state(null)
  let fileInputRef = $state(null)
  let folderDialogInputRef = $state(null)

  const folderOptions = $derived(buildFolderOptions(tree))
  const rootId = $derived(tree?.id ?? 'generic-tree-root')
  let rootDragActive = $state(false)
  const treeLogger = createLogger('components/ui/generic-element-tree')

  function logDragState(source, extra = {}) {
    if (!import.meta.env.DEV) return
    treeLogger.debug(source, {
      dragOverFolderId,
      rootDragActive,
      draggedNodeId,
      draggedNodeType,
      ...extra
    })
  }

  $effect(() => {
    if (!initialTree) return
    const normalized = normalizeTree(initialTree, rootName)
    tree = normalized
    if (!hasInitializedExternalTree) {
      hasInitializedExternalTree = true
      if (initialExpandedState) {
        expandedFolders = { ...initialExpandedState }
      } else {
        expandedFolders = { [normalized.id]: true }
      }
    } else if (!initialExpandedState && !expandedFolders[normalized.id]) {
      expandedFolders = { ...expandedFolders, [normalized.id]: true }
    }
  })

  $effect(() => {
    if (!initialExpandedState) return
    expandedFolders = { ...initialExpandedState }
  })

  const inlineActionHelpers = {
    isFolder: isFolderNode,
    toggleFolder: (folderId) => toggleFolder(folderId),
    startFolderDialog: (parentId) => startFolderDialog(parentId),
    startMoveDialog: (nodeId) => startMoveDialog(nodeId),
    deleteNode: (nodeId) => deleteNode(nodeId),
    moveNode: (nodeId, targetFolderId) => moveNode(nodeId, targetFolderId),
    createFolder: (parentId, name) => createFolder(parentId, name),
    closeContextMenu: () => closeContextMenu()
  }

  function getSortedChildren(node) {
    if (!node?.children) return []
    return [...node.children].sort(compareNodes)
  }

  function toggleFolder(folderId) {
    if (!folderId) return
    const nextState = {
      ...expandedFolders,
      [folderId]: !expandedFolders[folderId]
    }
    expandedFolders = nextState
    onExpandedFoldersChange({
      folderId,
      expanded: !!expandedFolders[folderId],
      expandedState: { ...expandedFolders }
    })
    notifyChange('folder-toggled', { folderId, expanded: !!expandedFolders[folderId] })
  }

  function updateTree(mutator) {
    mutator(tree)
    tree = { ...tree }
  }

  function notifyChange(reason, payload = {}) {
    if (typeof onTreeChange !== 'function') return
    onTreeChange({ reason, tree: cloneNode(tree), ...payload })
  }

  function createFolder(parentId, name) {
    if (!allowFolderCreation || !name) return
    let createdFolder = null
    let parentFolderId = null
    updateTree(currentTree => {
      const parent = findFolderById(currentTree, parentId) ?? currentTree
      parentFolderId = parent.id
      const folder = {
        id: generateNodeId('folder'),
        name,
        nodeType: 'folder',
        parentId: parent.id,
        children: []
      }
      parent.children = [...parent.children, folder]
      expandedFolders = { ...expandedFolders, [parent.id]: true, [folder.id]: true }
      createdFolder = cloneNode(folder)
    })
    if (createdFolder) {
      onExpandedFoldersChange({
        folderId: createdFolder.id,
        expanded: true,
        expandedState: { ...expandedFolders }
      })
    } else if (parentFolderId) {
      onExpandedFoldersChange({
        folderId: parentFolderId,
        expanded: true,
        expandedState: { ...expandedFolders }
      })
    }
    notifyChange('folder-created', { parentId, name, node: createdFolder })
  }

  function deleteNode(nodeId) {
    if (!nodeId || nodeId === rootId) return
    let removedName = ''
    let removedNode = null
    updateTree(currentTree => {
      const removed = removeNodeById(currentTree, nodeId)
      removedName = removed?.name ?? ''
      removedNode = removed ? cloneNode(removed) : null
    })
    notifyChange('node-deleted', { nodeId, name: removedName, node: removedNode })
    closeContextMenu()
  }

  function moveNode(nodeId, targetFolderId) {
    if (!nodeId || !targetFolderId || !allowNodeDrag) return
    if (nodeId === rootId) return
    if (nodeId === targetFolderId) return
    if (isAncestor(tree, targetFolderId, nodeId)) return
    let movedNode
    let movedSnapshot = null
    let targetFolderIdSnapshot = null
    updateTree(currentTree => {
      movedNode = removeNodeById(currentTree, nodeId)
      if (!movedNode) return
      const targetFolder = findFolderById(currentTree, targetFolderId) ?? currentTree
      movedNode.parentId = targetFolder.id
      targetFolder.children = [...targetFolder.children, movedNode]
      expandedFolders = { ...expandedFolders, [targetFolder.id]: true }
      targetFolderIdSnapshot = targetFolder.id
      movedSnapshot = cloneNode(movedNode)
    })
    if (movedNode) {
      onExpandedFoldersChange({
        folderId: targetFolderIdSnapshot ?? targetFolderId,
        expanded: true,
        expandedState: { ...expandedFolders }
      })
      notifyChange('node-moved', { nodeId, targetFolderId, node: movedSnapshot })
    }
  }

  function startFolderDialog(parentId) {
    if (!allowFolderCreation) return
    closeContextMenu()
    folderDialog = { visible: true, parentId: parentId ?? rootId, name: '' }
    tick().then(() => {
      folderDialogInputRef?.focus()
      folderDialogInputRef?.select()
    })
  }

  function confirmFolderDialog() {
    if (!folderDialog.visible) return
    const name = folderDialog.name.trim()
    if (!name) return
    createFolder(folderDialog.parentId || rootId, name)
    folderDialog = { ...FOLDER_DIALOG_INITIAL }
  }

  function cancelFolderDialog() {
    folderDialog = { ...FOLDER_DIALOG_INITIAL }
  }

  function startMoveDialog(nodeId) {
    closeContextMenu()
    if (!nodeId || nodeId === rootId) return
    moveDialog = { visible: true, nodeId, targetFolderId: rootId }
  }

  function confirmMoveDialog() {
    if (!moveDialog.visible) return
    moveNode(moveDialog.nodeId, moveDialog.targetFolderId)
    moveDialog = { ...MOVE_DIALOG_INITIAL }
  }

  function cancelMoveDialog() {
    moveDialog = { ...MOVE_DIALOG_INITIAL }
  }

  function handlePrimaryAction(node) {
    if (!node) return
    onNodeSelect(node)
    if (!isFolderNode(node)) {
      onNodeOpen(node)
    }
  }

  function handleInlineAction(event, action, node) {
    event.stopPropagation()
    if (action?.run) {
      action.run({ node, helpers: inlineActionHelpers })
    }
    notifyChange('inline-action', { nodeId: node?.id ?? null, actionId: action?.id ?? null })
  }

  function getMenuHelpers() {
    return {
      isFolder: isFolderNode,
      selectNode: (node) => handlePrimaryAction(node),
      startFolderDialog: (parentId) => startFolderDialog(parentId),
      startMoveDialog: (nodeId) => startMoveDialog(nodeId),
      deleteNode: (nodeId) => deleteNode(nodeId),
      closeMenu: () => closeContextMenu(),
      config: {
        allowFolderCreation,
        allowNodeDrag
      }
    }
  }

  function openContextMenu(event, node) {
    event.preventDefault()
    event.stopPropagation()
    const items = resolvedContextMenuBuilder ? resolvedContextMenuBuilder(node, getMenuHelpers()) ?? [] : []
    if (items.length === 0) {
      closeContextMenu()
      return
    }
    contextMenu = {
      visible: true,
      x: event.clientX,
      y: event.clientY,
      items
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

  function handleMenuItemClick(item) {
    if (!item || item.separator) return
    item.action?.()
    if (!item.keepOpen) {
      closeContextMenu()
    }
  }

  function handleNodeDragStart(event, node) {
    if (!allowNodeDrag) return
    draggedNodeId = node.id
    draggedNodeType = isFolderNode(node) ? 'folder' : 'document'
    event.dataTransfer?.setData(NODE_DRAG_TYPE, node.id)
    event.dataTransfer?.setDragImage(event.currentTarget, 0, 0)
    rootDragActive = true
    logDragState('nodeDragStart', { nodeId: node.id })
  }

  function handleNodeDragEnd() {
    draggedNodeId = null
    draggedNodeType = null
    dragOverFolderId = null
    rootDragActive = false
    logDragState('nodeDragEnd')
  }

  function getTargetFolderId(folderId) {
    return folderId ?? rootId
  }

  function handleFolderDragOver(event, folderId) {
    const targetFolderId = getTargetFolderId(folderId)
    const nodeDrag = allowNodeDrag && isNodeDrag(event)
    if (nodeDrag) {
      const dragData = getDragData(event)
      if (!dragData) return
      if (dragData.id === targetFolderId) return
      const draggedNode = findNodeById(tree, dragData.id)
      if (!draggedNode || draggedNode.parentId === targetFolderId) return
      if (isFolderNode(draggedNode) && isAncestor(tree, targetFolderId, dragData.id)) return
      event.preventDefault()
      event.stopPropagation()
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = 'move'
      }
      dragOverFolderId = targetFolderId
      logDragState('folderDragOver', { folderId: targetFolderId, nodeDrag: true })
      return
    }

    if (!allowExternalFileDrop) return
    const fileDrag = hasFilePayload(event)
    if (!fileDrag) return
    event.preventDefault()
    event.stopPropagation()
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'copy'
    }
    dragOverFolderId = targetFolderId
    logDragState('folderDragOver', { folderId: targetFolderId, fileDrag: true })
  }

  function handleFolderDragLeave(event, folderId) {
    const targetFolderId = getTargetFolderId(folderId)
    if (dragOverFolderId !== targetFolderId) return
    if (!isLeavingDropZone(event)) return
    if (!allowNodeDrag && !allowExternalFileDrop) return
    if (!isNodeDrag(event) && !hasFilePayload(event)) return
    event.stopPropagation()
    dragOverFolderId = null
    logDragState('folderDragLeave', { folderId: targetFolderId })
  }

  function handleFolderDrop(event, folderId) {
    const targetFolderId = getTargetFolderId(folderId)
    const nodeDrag = allowNodeDrag && isNodeDrag(event)
    const fileDrag = allowExternalFileDrop && hasFilePayload(event)
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
      rootDragActive = false
      logDragState('folderDropNode', { folderId: targetFolderId, draggedId: dragData?.id ?? null })
      return
    }
    const files = event.dataTransfer?.files
    if (files && files.length > 0) {
      handleFiles(files, targetFolderId)
    }
    rootDragActive = false
    logDragState('folderDropFiles', { folderId: targetFolderId })
  }

  function handleDrop(event) {
    const nodeDrag = allowNodeDrag && isNodeDrag(event)
    const fileDrag = allowExternalFileDrop && hasFilePayload(event)
    if (!nodeDrag && !fileDrag) return
    event.preventDefault()
    event.stopPropagation()
    dragOverFolderId = null
    rootDragActive = false
    if (nodeDrag) {
      const dragData = getDragData(event)
      draggedNodeId = null
      draggedNodeType = null
      if (dragData?.id) {
        moveNode(dragData.id, rootId)
      }
      logDragState('rootDropNode', { draggedId: dragData?.id ?? null })
      return
    }
    const files = event.dataTransfer?.files
    if (files && files.length > 0) {
      handleFiles(files, rootId)
    }
    logDragState('rootDrop', { files: event.dataTransfer?.files?.length ?? 0 })
  }

  function handleDragOver(event) {
    const nodeDrag = allowNodeDrag && isNodeDrag(event)
    const fileDrag = allowExternalFileDrop && hasFilePayload(event)
    if (!nodeDrag && !fileDrag) return
    event.preventDefault()
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = nodeDrag ? 'move' : 'copy'
    }
    if (event.target === event.currentTarget) {
      dragOverFolderId = rootId
    }
    rootDragActive = true
    logDragState('rootDragOver', { nodeDrag, fileDrag })
  }

  function handleDragLeave(event) {
    const nodeDrag = allowNodeDrag && isNodeDrag(event)
    const fileDrag = allowExternalFileDrop && hasFilePayload(event)
    if (!nodeDrag && !fileDrag) return
    if (event.target === event.currentTarget) {
      dragOverFolderId = null
      rootDragActive = false
      logDragState('rootDragLeave', { nodeDrag, fileDrag })
    }
  }

  function handleFileInput(event) {
    const files = event.target?.files
    if (files && files.length > 0) {
      handleFiles(files, rootId)
      event.target.value = ''
    }
  }

  function openFileInput() {
    fileInputRef?.click()
  }

  function handleFiles(files, targetFolderId) {
    const fileList = Array.from(files ?? [])
    if (fileList.length === 0) return
    let appendedNodes = []
    if (autoAppendDroppedFiles) {
      updateTree(currentTree => {
        const targetFolder = findFolderById(currentTree, targetFolderId) ?? currentTree
        const newNodes = fileList.map(file => ({
          id: generateNodeId('file'),
          name: file.name,
          nodeType: 'document',
          parentId: targetFolder.id,
          file,
          size: file.size,
          type: file.type,
          uploadedAt: new Date()
        }))
        appendedNodes = newNodes.map(node => cloneNode(node))
        targetFolder.children = [...targetFolder.children, ...newNodes]
      })
    }
    onFilesSelected({ files: fileList, targetFolderId, appendedNodes })
    notifyChange('files-dropped', { files: fileList, targetFolderId, nodes: appendedNodes })
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

  function isLeavingDropZone(event) {
    const current = event?.currentTarget
    if (!current) return true
    const next = event?.relatedTarget
    if (!next) return true
    return !current.contains(next)
  }

  function getDragData(event) {
    const raw = event?.dataTransfer?.getData(NODE_DRAG_TYPE)
    if (!raw) return null
    return { id: raw }
  }

  function handleWindowClick() {
    closeContextMenu()
  }

  function handleWindowKeydown(event) {
    if (event.key === 'Escape') {
      closeContextMenu()
      folderDialog = { ...FOLDER_DIALOG_INITIAL }
      moveDialog = { ...MOVE_DIALOG_INITIAL }
    }
  }

  onMount(() => {
    window.addEventListener('click', handleWindowClick)
    window.addEventListener('keydown', handleWindowKeydown)
    return () => {
      window.removeEventListener('click', handleWindowClick)
      window.removeEventListener('keydown', handleWindowKeydown)
    }
  })
</script>

<section
  class="generic-tree"
  data-panel-id={panelId}
  aria-label={title}
>
  {#if showHeader}
    <header>
      <h2>{title}</h2>
    </header>
  {/if}

  {#if allowExternalFileDrop}
    <input
      bind:this={fileInputRef}
      type="file"
      multiple
      onchange={handleFileInput}
      style="display: none"
      aria-label="Sélectionner des fichiers"
    />
  {/if}

  <div
    class="content"
    ondrop={handleDrop}
    ondragover={handleDragOver}
    ondragleave={handleDragLeave}
    oncontextmenu={handleBlankContextMenu}
    role="region"
    aria-label="Zone de dépôt"
  >
    <ul class="tree" role="tree">
      <ElementTreeNode
        node={tree}
        depth={0}
        {expandedFolders}
        {dragOverFolderId}
        {draggedNodeId}
        {draggedNodeType}
        rootId={rootId}
        {getSortedChildren}
        {toggleFolder}
        {openContextMenu}
        {handleNodeDragStart}
        {handleNodeDragEnd}
        {handleFolderDragOver}
        {handleFolderDragLeave}
        {handleFolderDrop}
        handlePrimaryAction={handlePrimaryAction}
        handleInlineAction={handleInlineAction}
        inlineActionBuilder={resolvedInlineActionsBuilder}
        inlineActionHelpers={inlineActionHelpers}
        resolveNodeIcon={iconResolver}
        allowNodeDrag={allowNodeDrag}
      />
    </ul>
  </div>

  {#if allowExternalFileDrop && showUploadHint}
    <button
      type="button"
      class="upload-hint"
      onclick={openFileInput}
      aria-label="Importer des éléments"
      title="Importer des éléments"
    >
      <span class="upload-hint-icon">{@html UploadIcon({ size: 20 }).svg}</span>
      <span class="upload-hint-text">{uploadHintText}</span>
    </button>
  {/if}

  {#if contextMenu.visible}
    <div
      class="context-menu"
      role="menu"
      tabindex="-1"
      style={`top: ${contextMenu.y}px; left: ${contextMenu.x}px`}
      onclick={(event) => event.stopPropagation()}
    >
      {#each contextMenu.items as item (item.id)}
        {#if item.separator}
          <div class="context-separator"></div>
        {:else}
          <button
            type="button"
            role="menuitem"
            class:danger={item.danger}
            onclick={() => handleMenuItemClick(item)}
            disabled={item.disabled}
          >
            {item.label}
          </button>
        {/if}
      {/each}
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
    <div class="modal-backdrop" role="presentation">
      <form
        class="modal"
        onsubmit={(event) => {
          event.preventDefault()
          confirmMoveDialog()
        }}
      >
        <h3>Déplacer l’élément</h3>
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
  .generic-tree {
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
    padding: 6px;
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 100%;
  }

  :global(.tree-item) {
    list-style: none;
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
    display: flex;
    flex-direction: column;
    position: relative;
  }

  :global(.item-content) {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 2px 6px;
    border-radius: 4px;
    cursor: pointer;
    user-select: none;
    color: inherit;
  }

  :global(.item-content:hover) {
    background: #2a2d2e;
  }

  :global(.item-content:focus) {
    outline: none;
    background: #094771;
  }

  :global(.tree-children) {
    list-style: none;
    margin: 0;
    padding-left: 0;
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
    background: #2a2d2e;
    color: #ffffff;
  }

  :global(.item-action.danger:hover) {
    background: #5a1d1d;
    color: #f48771;
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

  .upload-hint {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px;
    color: #6a6a6a;
    font-size: 12px;
    border-top: 1px solid #2e2e2e;
    margin: 0 8px;
    background: transparent;
    border: none;
    text-align: left;
    cursor: pointer;
    font-family: inherit;
    flex-shrink: 0;
  }

  .upload-hint:hover {
    color: #9a9a9a;
  }

  .upload-hint-icon {
    display: flex;
    opacity: 0.5;
  }

  .upload-hint-text {
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

  .context-menu button:hover:not(:disabled) {
    background: #094771;
  }

  .context-menu button.danger {
    color: #f48771;
  }

  .context-menu button:disabled {
    opacity: 0.5;
    cursor: default;
  }

  .context-separator {
    height: 1px;
    background: #3e3e42;
    margin: 4px 0;
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
    background: #2a2d2e;
    color: #cccccc;
  }

  .modal-actions .secondary:hover {
    background: #3a3d3e;
  }

  .modal-actions button[type='submit'] {
    background: #0e639c;
    color: #ffffff;
  }

  .modal-actions button[type='submit']:hover {
    background: #1177bb;
  }
</style>
