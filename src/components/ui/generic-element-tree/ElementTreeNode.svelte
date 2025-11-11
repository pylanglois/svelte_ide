<script>
  import { ChevronDownIcon, ChevronRightIcon } from './icons.js'

  function isFolderNode(node) {
    const kind = node?.nodeType ?? node?.kind ?? node?.type
    return kind === 'folder'
  }

  let {
    node,
    depth = 0,
    expandedFolders,
    dragOverFolderId,
    draggedNodeId,
    draggedNodeType,
    rootId,
    getSortedChildren,
    toggleFolder,
    openContextMenu,
    handleNodeDragStart,
    handleNodeDragEnd,
    handleFolderDragOver,
    handleFolderDragLeave,
    handleFolderDrop,
    handlePrimaryAction,
    handleInlineAction,
    inlineActionBuilder,
    inlineActionHelpers,
    resolveNodeIcon,
    allowNodeDrag = true
  } = $props()

  const isFolder = $derived(isFolderNode(node))
  const isExpanded = $derived(isFolder ? !!expandedFolders[node?.id] : false)
  const childNodes = $derived(isFolder ? getSortedChildren(node) : [])
  const indent = $derived(Math.max(0, depth) * 14)
  const folderDraggable = $derived(isFolder && node?.id !== rootId)
  const nodeDraggable = $derived(allowNodeDrag && (folderDraggable || !isFolder))
  const inlineActions = $derived(
    inlineActionBuilder ? inlineActionBuilder(node, inlineActionHelpers) ?? [] : []
  )
  const nodeIcon = $derived(resolveNodeIcon(node, { isFolder }) ?? null)
</script>

<li
  class="tree-item"
  class:folder={isFolder}
  class:document={!isFolder}
  class:drag-over={isFolder && dragOverFolderId === node.id}
  class:root={node?.id === rootId}
  class:dragging-document={draggedNodeType === 'document' && draggedNodeId === node.id}
  class:dragging-folder={draggedNodeType === 'folder' && draggedNodeId === node.id}
  role="treeitem"
  aria-expanded={isFolder ? isExpanded : undefined}
  aria-selected="false"
  aria-level={depth + 1}
>
  <div
    class="tree-node"
    ondragover={isFolder ? (event) => handleFolderDragOver(event, node.id) : undefined}
    ondragleave={isFolder ? (event) => handleFolderDragLeave(event, node.id) : undefined}
    ondrop={isFolder ? (event) => handleFolderDrop(event, node.id) : undefined}
  >
    <div
      class="item-content"
      style={`padding-left: ${indent}px`}
      onclick={() => handlePrimaryAction(node)}
      ondblclick={() => (isFolder ? toggleFolder(node.id) : undefined)}
      onkeydown={(event) => {
        if (event.key === 'Enter') {
          if (isFolder) {
            toggleFolder(node.id)
          } else {
            handlePrimaryAction(node)
          }
        }
      }}
      tabindex="0"
      role="button"
      oncontextmenu={(event) => openContextMenu(event, node)}
      draggable={nodeDraggable}
      ondragstart={nodeDraggable ? (event) => handleNodeDragStart(event, node) : undefined}
      ondragend={nodeDraggable ? handleNodeDragEnd : undefined}
    >
      {#if isFolder}
        <button
          type="button"
          class="twisty"
          onclick={(event) => {
            event.stopPropagation()
            toggleFolder(node.id)
          }}
          aria-label={isExpanded ? 'Réduire' : 'Développer'}
        >
          {@html (isExpanded ? ChevronDownIcon : ChevronRightIcon)({ size: 12 }).svg}
        </button>
      {:else}
        <span class="twisty placeholder"></span>
      {/if}

      <span class="item-icon">
        {#if nodeIcon}
          {@html nodeIcon.svg}
        {:else}
          <span class="icon-placeholder">•</span>
        {/if}
      </span>

      <span class="item-label">{node?.name ?? ''}</span>

      {#if inlineActions.length > 0}
        {#each inlineActions as action (action.id)}
          <button
            type="button"
            class="item-action"
            class:danger={action.danger}
            onclick={(event) => handleInlineAction(event, action, node)}
            title={action.title ?? action.label ?? ''}
            aria-label={action.ariaLabel ?? action.label ?? ''}
            disabled={action.disabled}
          >
            {#if action.icon}
              {@html action.icon}
            {:else}
              <span>{action.label ?? ''}</span>
            {/if}
          </button>
        {/each}
      {/if}
    </div>

    {#if isFolder && isExpanded && childNodes.length > 0}
      <ul class="tree-children" role="group">
        {#each childNodes as child (child.id)}
          <svelte:self
            node={child}
            depth={depth + 1}
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
            {handlePrimaryAction}
            {handleInlineAction}
            {inlineActionBuilder}
            {inlineActionHelpers}
            {resolveNodeIcon}
            {allowNodeDrag}
          />
        {/each}
      </ul>
    {/if}
  </div>
</li>
