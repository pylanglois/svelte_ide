<script>
import { bootStore } from '../../stores/bootStore.svelte.js'
import { getAuthStore } from '../../stores/authStore.svelte.js'
import BootErrorScreen from './BootErrorScreen.svelte'
import LoginScreen from './LoginScreen.svelte'

let { children } = $props()

const authStore = getAuthStore()

$effect(() => {
  void bootStore.start()
})

$effect(() => {
  authStore.isAuthenticated
  authStore.initialized
  bootStore.sync()
})
</script>

{#if bootStore.state === 'error'}
  <BootErrorScreen error={bootStore.error} />
{:else if bootStore.state === 'authenticated'}
  {@render children?.()}
{:else}
  <LoginScreen />
{/if}
