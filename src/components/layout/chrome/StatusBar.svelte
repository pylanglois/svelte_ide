<script>
  import { statusBarService } from '@/core/StatusBarService.svelte.js'

  let sections = $state({
    left: [],
    center: [],
    right: []
  })

  $effect(() => {
    sections = statusBarService.sections
  })

  function getDisplayText(item) {
    if (typeof item.text === 'function') {
      try {
        return item.text()
      } catch (error) {
        console.warn('StatusBar: failed to resolve text item', error)
        return ''
      }
    }
    return item.text ?? ''
  }
</script>

<div class="status-bar">
  <div class="status-left">
    {#each sections.left as item (item.id)}
      {@const Component = item.component}
      {#if Component}
        <Component {...item.props} />
      {:else if item.text}
        <span class={`status-text ${item.className || ''}`} aria-label={item.ariaLabel || undefined}>
          {getDisplayText(item)}
        </span>
      {/if}
    {/each}
  </div>
  
  <div class="status-center">
    {#each sections.center as item (item.id)}
      {@const Component = item.component}
      {#if Component}
        <Component {...item.props} />
      {:else if item.text}
        <span class={`status-text ${item.className || ''}`} aria-label={item.ariaLabel || undefined}>
          {getDisplayText(item)}
        </span>
      {/if}
    {/each}
  </div>
  
  <div class="status-right">
    {#each sections.right as item (item.id)}
      {@const Component = item.component}
      {#if Component}
        <Component {...item.props} />
      {:else if item.text}
        <span class={`status-text ${item.className || ''}`} aria-label={item.ariaLabel || undefined}>
          {getDisplayText(item)}
        </span>
      {/if}
    {/each}
  </div>
</div>

<style>
  .status-bar {
    height: 24px;
    background: #007acc;
    color: white;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 12px;
    font-size: 12px;
    position: relative;
  }

  .status-left, .status-center, .status-right {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .status-center {
    flex: 1;
    justify-content: center;
  }

  .status-text,
  :global(.status-message) {
    color: white;
  }

  :global(.status-active-file) {
    color: rgba(255, 255, 255, 0.9);
    font-style: italic;
  }

  :global(.status-clock) {
    color: rgba(255, 255, 255, 0.8);
    font-family: 'Courier New', monospace;
  }
</style>
