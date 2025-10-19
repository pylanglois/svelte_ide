<script>
  import { contextMenuService } from '@/core/ContextMenuService.svelte.js'

  let menuElement = $state(null)

  function handleItemClick(item) {
    contextMenuService.executeAction(item.id)
  }

  function focusFirstItem() {
    if (!menuElement) return
    const items = menuElement.querySelectorAll('[role="menuitem"]:not(.disabled)')
    if (items.length > 0) {
      items[0].focus()
    } else {
      menuElement.focus()
    }
  }

  function handleMenuKeyDown(e) {
    if (!menuElement) return
    if (e.key === 'Escape') {
      e.preventDefault()
      contextMenuService.hide()
      return
    }
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return

    e.preventDefault()
    const items = Array.from(menuElement.querySelectorAll('[role="menuitem"]:not(.disabled)'))
    if (items.length === 0) return
    const currentIndex = items.indexOf(document.activeElement)
    let nextIndex = currentIndex
    if (e.key === 'ArrowDown') {
      nextIndex = (currentIndex + 1) % items.length
    } else if (e.key === 'ArrowUp') {
      nextIndex = (currentIndex - 1 + items.length) % items.length
    }
    items[nextIndex]?.focus()
  }

  // Gestion des événements globaux avec $effect
  $effect(() => {
    const handleClickOutside = (e) => {
      if (contextMenuService.isVisible && !e.target.closest('.context-menu')) {
        contextMenuService.hide()
      }
    }

    const handleGlobalContextMenu = (e) => {
      if (!e.target.closest('[data-context-menu]')) {
        e.preventDefault()
        contextMenuService.hide()
      }
    }

    document.addEventListener('click', handleClickOutside)
    document.addEventListener('contextmenu', handleGlobalContextMenu)

    // Fonction de nettoyage retournée par $effect
    return () => {
      document.removeEventListener('click', handleClickOutside)
      document.removeEventListener('contextmenu', handleGlobalContextMenu)
    }
  })

  $effect(() => {
    if (contextMenuService.isVisible) {
      focusFirstItem()
    }
  })
</script>

{#if contextMenuService.isVisible}
  <div 
    class="context-menu" 
    style="left: {contextMenuService.position.x}px; top: {contextMenuService.position.y}px;"
    role="menu"
    aria-label="Menu contextuel"
    tabindex="-1"
    bind:this={menuElement}
    onkeydown={handleMenuKeyDown}
  >
    {#each contextMenuService.menuItems as item}
      <div 
        class="menu-item" 
        class:disabled={item.disabled}
        role="menuitem"
        tabindex={item.disabled ? -1 : 0}
        onclick={() => !item.disabled && handleItemClick(item)}
        onkeydown={(e) => {
          if ((e.key === 'Enter' || e.key === ' ') && !item.disabled) {
            e.preventDefault()
            handleItemClick(item)
          }
        }}
        aria-disabled={item.disabled}
      >
        {#if item.icon}
          <span class="icon" aria-hidden="true">{item.icon}</span>
        {/if}
        <span class="label">{item.label}</span>
        {#if item.shortcut}
          <span class="shortcut">{item.shortcut}</span>
        {/if}
      </div>
      {#if item.separator}
        <div class="separator" role="separator" aria-hidden="true"></div>
      {/if}
    {/each}
  </div>
{/if}

<style>
  .context-menu {
    position: fixed;
    background: #3c3c3c;
    border: 1px solid #5a5a5a;
    border-radius: 4px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
    z-index: 10000;
    min-width: 180px;
    padding: 4px 0;
    font-size: 13px;
    color: #cccccc;
  }

  .menu-item {
    display: flex;
    align-items: center;
    padding: 6px 12px;
    cursor: pointer;
    user-select: none;
  }

  .menu-item:hover:not(.disabled) {
    background: #094771;
    color: #ffffff;
  }

  .menu-item.disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .icon {
    margin-right: 8px;
    width: 16px;
    text-align: center;
  }

  .label {
    flex: 1;
  }

  .shortcut {
    font-size: 11px;
    opacity: 0.7;
    margin-left: 16px;
  }

  .separator {
    height: 1px;
    background: #5a5a5a;
    margin: 4px 0;
  }
</style>
