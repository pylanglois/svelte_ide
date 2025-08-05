<script>
  import { ideStore } from '@/stores/ideStore.svelte.js'

  let { position } = $props()
  let activeTool = $state(null)
  
  $effect(() => {
    activeTool = ideStore.activeToolsByPosition[position]
  })
</script>

{#if activeTool}
  <div class="tool-panel"
       style:grid-area={position}
       tabindex="-1"
       onfocus={() => ideStore.setFocusedPanel(position)}
       onblur={() => ideStore.clearFocusedPanel()}
       onclick={() => ideStore.setFocusedPanel(position)}
  >
    <div class="panel-content">
      {@render activeTool.component(activeTool.componentProps)}
    </div>
  </div>
{/if}

<style>
  .tool-panel {
    background: #252526;
    display: flex;
    flex-direction: column;
    position: relative;
    outline: none;
    overflow: hidden;
    height: 100%;
  }

  .panel-content {
    flex: 1;
    overflow: auto;
  }
</style>
