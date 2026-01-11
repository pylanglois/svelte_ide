<script>
import { sideStore } from '../stores/sideStore.svelte.js'
import { themeService } from '../core/themeService.svelte.js'

let { capabilities = [] } = $props()

$effect(() => {
  capabilities.forEach(capability => sideStore.registerCapability(capability))
  if (capabilities.length > 0 && !sideStore.activeCapability) {
    sideStore.setActiveCapability(capabilities[0].id)
  }
})
</script>

<div class="side-container" style:--background={themeService.getColor('background')}>
  <div class="side-content">
    {#if sideStore.activeCapability?.component}
      {@const Component = sideStore.activeCapability.component}
      <Component />
    {/if}
  </div>
</div>

<style>
.side-container {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100vh;
  background: var(--background);
}

.side-content {
  flex: 1;
  overflow: auto;
}
</style>
