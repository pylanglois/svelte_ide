<script>
  import { ideStore } from '@/stores/ideStore.svelte.js'

  const props = $props()
  let fallback = 'Prêt'
  let className = ''

  $effect(() => {
    ({ fallback = 'Prêt', className = '' } = props)
  })
</script>

<span class={`status-message ${className}`}>
  {ideStore.statusMessage || fallback}
</span>
