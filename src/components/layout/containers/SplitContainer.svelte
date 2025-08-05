<script>
  import ResizeHandle from './ResizeHandle.svelte'
  import LayoutContainer from './LayoutContainer.svelte'
  import { layoutService } from '@/core/LayoutService.svelte.js'

  let { layoutNode } = $props()

  function createResizeHandler(index) {
    return (e) => {
      e.preventDefault()
      const startX = e.clientX
      const startY = e.clientY
      const container = e.target.closest('.split-container')
      const panes = container.querySelectorAll('.split-pane')
      
      const isHorizontal = layoutNode.direction === 'horizontal'
      const containerSize = isHorizontal ? container.offsetWidth : container.offsetHeight
      
      const startSizes = layoutNode.sizes ? [...layoutNode.sizes] : 
        new Array(layoutNode.children.length).fill(100 / layoutNode.children.length)

      function handleMouseMove(e) {
        const deltaX = e.clientX - startX
        const deltaY = e.clientY - startY
        const delta = isHorizontal ? deltaX : deltaY
        const deltaPercent = (delta / containerSize) * 100

        const newSizes = [...startSizes]
        newSizes[index] = Math.max(10, Math.min(90, startSizes[index] + deltaPercent))
        newSizes[index + 1] = Math.max(10, Math.min(90, startSizes[index + 1] - deltaPercent))

        layoutService.updateSizes(layoutNode.id, newSizes)
      }

      function handleMouseUp() {
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
      }

      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
    }
  }
</script>

<div 
  class="split-container" 
  class:horizontal={layoutNode.direction === 'horizontal'} 
  class:vertical={layoutNode.direction === 'vertical'}
>
  {#each layoutNode.children as childNode, index (childNode.id)}
    <div 
      class="split-pane" 
      style:flex="0 0 {layoutNode.sizes?.[index] || 50}%"
      style:width={layoutNode.direction === 'horizontal' ? `${layoutNode.sizes?.[index] || 50}%` : 'auto'}
      style:height={layoutNode.direction === 'vertical' ? `${layoutNode.sizes?.[index] || 50}%` : 'auto'}
    >
      <LayoutContainer layoutNode={childNode} />
    </div>
    
    {#if index < layoutNode.children.length - 1}
      <ResizeHandle 
        direction={layoutNode.direction === 'horizontal' ? 'vertical' : 'horizontal'} 
        onResizeStart={createResizeHandler(index)} 
      />
    {/if}
  {/each}
</div>

<style>
  .split-container {
    display: flex;
    width: 100%;
    height: 100%;
    overflow: hidden;
  }

  .split-container.horizontal {
    flex-direction: row;
  }

  .split-container.vertical {
    flex-direction: column;
  }

  .split-pane {
    display: flex;
    flex-direction: column;
    min-width: 0;
    min-height: 0;
    overflow: hidden;
  }

  .split-container.horizontal .split-pane {
    min-width: 100px;
  }

  .split-container.vertical .split-pane {
    min-height: 100px;
  }
</style>
