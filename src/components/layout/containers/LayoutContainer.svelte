<script>
  import SplitContainer from './SplitContainer.svelte'
  import TabBar from '../navigation/TabBar.svelte'
  import DropZones from '../navigation/DropZones.svelte'
  import TabGroupContent from '../navigation/TabGroupContent.svelte'

  let { layoutNode } = $props()
</script>

<!-- Rendu récursif : Container ou TabGroup -->
{#if layoutNode.type === 'container'}
  <SplitContainer {layoutNode} />
{:else if layoutNode.type === 'tabgroup'}
  <div class="tabgroup">
    {#if layoutNode.tabs.length > 0}
      <TabBar {layoutNode} />
      <DropZones {layoutNode}>
        {#snippet children()}
          <TabGroupContent {layoutNode} />
        {/snippet}
      </DropZones>
    {:else}
      <TabGroupContent {layoutNode} />
    {/if}
  </div>
{/if}

<style>
  .tabgroup {
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
    overflow: hidden;
  }
</style>
