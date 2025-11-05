<script>
  import { ideStore } from '@/stores/ideStore.svelte.js'

  const props = $props()
  const label = $derived(props.label ?? 'Fichier actif :')
  const emptyLabel = $derived(props.emptyLabel ?? '')
  const className = $derived(props.className ?? '')

  function getActiveTabLabel(tab) {
    if (!tab) {
      return ''
    }
    if (typeof tab.title === 'string' && tab.title.trim()) {
      return tab.title
    }
    if (typeof tab.fileName === 'string' && tab.fileName.trim()) {
      return tab.fileName
    }
    if (typeof tab.id === 'string' && tab.id.trim()) {
      return tab.id
    }
    return ''
  }
</script>

{#if ideStore.activeTab}
  {@const labelText = getActiveTabLabel(ideStore.activeTab)}
  {#if labelText}
    <span class={`status-active-file ${className}`}>
      {label} {labelText}
    </span>
  {/if}
{:else if emptyLabel}
  <span class={`status-active-file ${className} is-empty`}>
    {emptyLabel}
  </span>
{/if}
