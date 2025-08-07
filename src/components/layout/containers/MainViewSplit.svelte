<script>
  import { layoutService } from '@/core/LayoutService.svelte.js'
  import { ideStore } from '@/stores/ideStore.svelte.js'
  import LayoutContainer from './LayoutContainer.svelte'

  // Surveillance des changements pour la sauvegarde automatique
  $effect(() => {
    if (layoutService.layout) {
      layoutService._triggerAutoSave()
    }
  })
</script>

<div class="main-view-split">
  {#if layoutService.tabs.length === 0}
    <!-- Afficher un simple hello si aucun tab n'est ouvert -->
    <div class="welcome-content">
      <h1>hello</h1>
    </div>
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

  .welcome-content {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .welcome-content h1 {
    font-size: 48px;
    font-weight: 300;
    color: white;
    margin: 0;
  }
</style>
