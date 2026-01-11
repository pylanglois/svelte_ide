<script>
import { themeService } from '../../core/themeService.svelte.js'

let mode = $derived(themeService.mode)
let nextLabel = $derived(mode === 'dark' ? 'Light' : 'Dark')
let nextAria = $derived(mode === 'dark' ? 'Switch to light theme' : 'Switch to dark theme')

function toggleTheme() {
  themeService.toggleMode()
}
</script>

<button class="side-theme-toggle" onclick={toggleTheme} type="button" aria-label={nextAria}>
  {nextLabel}
</button>

<style>
.side-theme-toggle {
  background: transparent;
  border: 1px solid var(--border);
  color: inherit;
  padding: 4px 8px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
}

.side-theme-toggle:hover {
  background: var(--surface-hover);
}
</style>
