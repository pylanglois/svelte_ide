<script>
import { themeService } from '../core/themeService.svelte.js'
import SideContainer from './SideContainer.svelte'
import SideTopBar from './chrome/SideTopBar.svelte'
import AuthUserMenu from './chrome/AuthUserMenu.svelte'

let { capabilities = [], branding = null } = $props()
</script>

<div
  class="side-app-shell"
  style:--background={themeService.getColor('background')}
  style:--surface={themeService.getColor('surface')}
  style:--text={themeService.getColor('text')}
  style:--border={themeService.getColor('border')}
  style:--primary={themeService.getColor('primary')}
  style:--shadow={themeService.getShadow('md')}
>
  <SideTopBar {branding} authComponent={AuthUserMenu} />

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
