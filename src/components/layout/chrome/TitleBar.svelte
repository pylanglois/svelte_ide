<script>
  import AuthUserMenu from './AuthUserMenu.svelte'
  import MainMenu from './MainMenu.svelte'
  import { getAuthStore } from '@/stores/authStore.svelte.js'

  let { branding = null } = $props()

  const brandingComponent = $derived(branding?.component ?? null)
  const brandingProps = $derived(branding?.props ?? {})

  const authStore = getAuthStore()
  let isAuthenticated = $state(false)

  $effect(() => {
    isAuthenticated = authStore.isAuthenticated
  })
</script>

<div class="title-bar">
  <div class="left-area">
    {#if brandingComponent}
      <div class="logo-wrapper">
        {@render brandingComponent(brandingProps)}
      </div>
    {/if}
    {#if isAuthenticated}
      <MainMenu />
    {/if}
  </div>

  <AuthUserMenu />
</div>

<style>
  .title-bar {
    height: 32px;
    background: #2d2d30;
    border-bottom: 1px solid #3e3e42;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 16px;
    color: #cccccc;
    font-size: 13px;
    position: relative;
    z-index: 1000;
  }

  .left-area {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  
  .logo-wrapper {
    flex-shrink: 0;
    display: flex;
    align-items: center;
  }
</style>
