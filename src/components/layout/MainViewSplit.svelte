<script>
  import { layoutService } from '@/core/LayoutService.svelte.js'
  import { ideStore } from '@/stores/ideStore.svelte.js'
  import WelcomeScreen from '@/components/layout/WelcomeScreen.svelte'
  import LayoutContainer from '@/components/layout/LayoutContainer.svelte'
</script>

<div class="main-view-split">
  {#if !ideStore.user}
    <WelcomeScreen />
  {:else}
    <!-- Rendu du layout avec support futur pour les splits -->
    <LayoutContainer layoutNode={layoutService.layout} />
  {/if}
</div>

<style>
  .main-view-split {
    flex: 1;
    background: #1e1e1e;
    display: flex;
    flex-direction: column;
    min-width: 0;
    overflow: hidden;
  }
</style>
