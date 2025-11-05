<script>
  import { ideStore } from '@/stores/ideStore.svelte.js'

  const props = $props()
  const fallback = $derived(props.fallback ?? 'Prêt')
  const className = $derived(props.className ?? '')
</script>

<span class={`status-message ${className}`}>
  {ideStore.statusMessage || fallback}
</span>
