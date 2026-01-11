<script>
import ThemeToggle from './ThemeToggle.svelte'
import AuthUserMenu from './AuthUserMenu.svelte'
</script>

<div class="side-top-actions">
  <ThemeToggle />
  <AuthUserMenu />
</div>

<style>
.side-top-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}
</style>
