<script>
import SideContainer from './SideContainer.svelte'
import SideTopBar from './chrome/SideTopBar.svelte'
import SideTopBarActions from './chrome/SideTopBarActions.svelte'

let { capabilities = [], branding = null } = $props()
</script>

<div class="side-app-shell">
  <SideTopBar {branding} rightComponent={SideTopBarActions} />

  <div class="side-main">
    <SideContainer {capabilities} />
  </div>
</div>

<style>
.side-app-shell {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100vh;
  background: var(--background);
  color: var(--text);
}

.side-main {
  flex: 1;
  min-height: 0;
}

:global(.side-app-shell .side-main .side-container) {
  height: 100%;
}
</style>
