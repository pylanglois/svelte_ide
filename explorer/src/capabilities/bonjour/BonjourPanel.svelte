<script>
import { i18nService, themeService } from '@svelte-ide/core'
</script>

<div
  class="bonjour-panel"
  style:--primary={themeService.getColor('primary')}
  style:--background={themeService.getColor('background')}
>
  <h1>{i18nService.t('bonjour.title')}</h1>
</div>

<style>
.bonjour-panel {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  background: var(--background);
}

.bonjour-panel h1 {
  color: var(--primary);
  font-size: 1.5rem;
  font-weight: 600;
  letter-spacing: 0.02em;
}
</style>
