<script>
  import { contextMenuService } from '@/core/ContextMenuService.svelte.js'

  // Plus besoin d'état local, on accède directement au service réactif
  // avec les runes Svelte 5, le service est automatiquement réactif

  function handleItemClick(item) {
    contextMenuService.executeAction(item.id)
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
</script>

{#if contextMenuService.isVisible}
  <div 
    class="context-menu" 
    style="left: {contextMenuService.position.x}px; top: {contextMenuService.position.y}px;"
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
      >
        {#if item.icon}
          <span class="icon">{item.icon}</span>
        {/if}
        <span class="label">{item.label}</span>
        {#if item.shortcut}
          <span class="shortcut">{item.shortcut}</span>
        {/if}
      </div>
      {#if item.separator}
        <div class="separator"></div>
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
