<script>
  import { layoutService } from '@/core/LayoutService.svelte.js'
  import { ideStore } from '@/stores/ideStore.svelte.js'
  import WelcomeScreen from '../ui/WelcomeScreen.svelte'
  import LayoutContainer from './LayoutContainer.svelte'

  // Surveillance des changements pour la sauvegarde automatique
  $effect(() => {
    if (layoutService.layout) {
      layoutService._triggerAutoSave()
    }
  })
</script>

<div class="main-view-split">
  {#if !ideStore.user}
    <WelcomeScreen />
  {:else if layoutService.tabs.length === 0}
    <!-- Afficher la page de bienvenue si aucun tab n'est ouvert -->
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
