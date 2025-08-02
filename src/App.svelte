<script>
  import { toolManager } from '@/core/ToolManager.svelte.js'
  import { ideStore } from '@/stores/ideStore.svelte.js'
  import { eventBus } from '@/core/EventBusService.svelte.js'
  import { ConsoleTool, NotificationsTool } from '@/core/SystemTools.js'

  import TitleBar from '@/components/layout/TitleBar.svelte'
  import Toolbar from '@/components/layout/Toolbar.svelte'
  import StatusBar from '@/components/layout/StatusBar.svelte'
  import MainView from '@/components/layout/MainView.svelte'
  import MainViewSplit from '@/components/layout/MainViewSplit.svelte'
  import ContextMenu from '@/components/layout/ContextMenu.svelte'
  import ToolPanel from '@/components/layout/ToolPanel.svelte'
  import ResizeHandle from '@/components/layout/ResizeHandle.svelte'

  // FEATURE FLAG : activer/désactiver le nouveau système de splits
  const USE_SPLIT_VIEW = true

  let leftPanelWidth = $state(250)
  let rightPanelWidth = $state(250)
  let bottomPanelHeight = $state(200)

  function createResizeLogic(panel) {
    return (e) => {
      e.preventDefault()
      const startX = e.clientX
      const startY = e.clientY
      const startWidth = leftPanelWidth
      const startHeight = bottomPanelHeight
      const startRightWidth = rightPanelWidth

      const handleResize = (e) => {
        switch (panel) {
          case 'left':
            leftPanelWidth = Math.max(50, startWidth + (e.clientX - startX))
            break
          case 'right':
            rightPanelWidth = Math.max(50, startRightWidth - (e.clientX - startX))
            break
          case 'bottom':
            bottomPanelHeight = Math.max(50, startHeight - (e.clientY - startY))
            break
        }
      }

      const stopResize = () => {
        document.removeEventListener('mousemove', handleResize)
        document.removeEventListener('mouseup', stopResize)
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
      }

      document.addEventListener('mousemove', handleResize)
      document.addEventListener('mouseup', stopResize)
      document.body.style.userSelect = 'none'
      if (panel === 'bottom') {
        document.body.style.cursor = 'ns-resize'
      } else {
        document.body.style.cursor = 'ew-resize'
      }
    }
  }

  // Initialisation unique à la création du composant
  (async () => {
    window.toolManager = toolManager
    ideStore.setStatusMessage('Chargement des outils système...')
    
    // Activation du mode de débogage de l'EventBus
    eventBus.setDebugMode(true)

    // Enregistrement des outils système
    const console = new ConsoleTool()
    toolManager.registerTool(console)
    toolManager.registerTool(new NotificationsTool())

    // Activation de la console par défaut
    ideStore.toggleTool(console.id)

    ideStore.setStatusMessage('Chargement des outils externes...')
    await toolManager.loadTools()
    ideStore.setStatusMessage('IDE prêt')
  })()
</script>

<div class="app">
  <ContextMenu />
  <TitleBar />

  {#if ideStore.user}
    <div class="main-container">
      <Toolbar position="left" />
      
      <div class="content-area">
        <div class="panels-wrapper">
          {#if ideStore.activeToolsByPosition.topLeft || ideStore.activeToolsByPosition.bottomLeft}
            <div class="side-panel-container left" style:width="{leftPanelWidth}px">
              <ToolPanel position="topLeft" />
              <ToolPanel position="bottomLeft" />
            </div>
            <ResizeHandle direction="vertical" onResizeStart={createResizeLogic('left')} />
          {/if}
          
          {#if USE_SPLIT_VIEW}
            <MainViewSplit />
          {:else}
            <MainView />
          {/if}
          
          {#if ideStore.activeToolsByPosition.topRight || ideStore.activeToolsByPosition.bottomRight}
            <ResizeHandle direction="vertical" onResizeStart={createResizeLogic('right')} />
            <div class="side-panel-container right" style:width="{rightPanelWidth}px">
              <ToolPanel position="topRight" />
              <ToolPanel position="bottomRight" />
            </div>
          {/if}
        </div>
        
        {#if ideStore.activeToolsByPosition.bottom}
          <ResizeHandle direction="horizontal" onResizeStart={createResizeLogic('bottom')} />
          <div class="bottom-panel-container" style:height="{bottomPanelHeight}px">
            <ToolPanel position="bottom" />
          </div>
        {/if}
      </div>
      
      <Toolbar position="right" />
    </div>
    
    <StatusBar />
  {:else}
    <div class="welcome-container">
      <MainView />
    </div>
  {/if}
</div>

<style>
  :global(*) {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }

  :global(body) {
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    overflow: hidden;
    background: #1e1e1e;
    color: #cccccc;
  }

  .app {
    height: 100vh;
    display: flex;
    flex-direction: column;
    background: #2d2d30;
    user-select: none;
  }

  .main-container {
    flex: 1;
    display: flex;
    overflow: hidden;
  }

  .content-area {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    min-width: 0;
  }

  .panels-wrapper {
    flex: 1;
    display: flex;
    overflow: hidden;
    min-height: 0;
  }

  .side-panel-container {
    display: flex;
    flex-direction: column;
    height: 100%;
    flex-shrink: 0;
  }
  
  .side-panel-container > :global(.tool-panel) {
    flex: 1;
    min-height: 0;
  }

  .bottom-panel-container {
    flex-shrink: 0;
  }

  .welcome-container {
    flex: 1;
    display: flex;
    overflow: hidden;
  }
</style>
