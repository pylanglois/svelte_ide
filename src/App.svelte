<script>
  import { toolManager } from '@/core/ToolManager.svelte.js'
  import { ideStore } from '@/stores/ideStore.svelte.js'
  import { getAuthStore } from '@/stores/authStore.svelte.js'
  import { eventBus } from '@/core/EventBusService.svelte.js'
  import { ConsoleTool, NotificationsTool } from '@/core/SystemTools.js'

  import TitleBar from '@/components/layout/chrome/TitleBar.svelte'
  import Toolbar from '@/components/layout/chrome/Toolbar.svelte'
  import StatusBar from '@/components/layout/chrome/StatusBar.svelte'
  import MainViewSplit from '@/components/layout/containers/MainViewSplit.svelte'
  import ContextMenu from '@/components/layout/ui/ContextMenu.svelte'
  import ResizeHandle from '@/components/layout/containers/ResizeHandle.svelte'
  import AuthPanel from '@/components/layout/ui/AuthPanel.svelte'
  import WelcomeScreen from '@/components/layout/ui/WelcomeScreen.svelte'
  import ToolPanel from '@/components/layout/chrome/ToolPanel.svelte'

  const authStore = getAuthStore()

  let { externalTools = [] } = $props()
  const KEYBOARD_RESIZE_STEP = 16

  let leftPanelWidth = $state(250)
  let rightPanelWidth = $state(250)
  let bottomPanelHeight = $state(200)
  
  let hasTopLeft = $state(false)
  let hasBottomLeft = $state(false)
  let hasTopRight = $state(false)
  let hasBottomRight = $state(false)
  let hasBottom = $state(false)

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

  function adjustLeftPanel(delta) {
    const nextWidth = delta < 0 ? leftPanelWidth - KEYBOARD_RESIZE_STEP : leftPanelWidth + KEYBOARD_RESIZE_STEP
    leftPanelWidth = Math.max(50, nextWidth)
  }

  function adjustRightPanel(delta) {
    const nextWidth = delta < 0 ? rightPanelWidth + KEYBOARD_RESIZE_STEP : rightPanelWidth - KEYBOARD_RESIZE_STEP
    rightPanelWidth = Math.max(50, nextWidth)
  }

  function adjustBottomPanel(delta) {
    const nextHeight = delta < 0 ? bottomPanelHeight + KEYBOARD_RESIZE_STEP : bottomPanelHeight - KEYBOARD_RESIZE_STEP
    bottomPanelHeight = Math.max(50, nextHeight)
  }

  (async () => {
    window.toolManager = toolManager
    ideStore.setStatusMessage('Initialisation du systeme...')
    
    await authStore.initialize()
    
    ideStore.setStatusMessage('Chargement des outils systeme...')
    
    const consoleTool = new ConsoleTool()
    toolManager.registerTool(consoleTool)
    toolManager.registerTool(new NotificationsTool())

    if (consoleTool.panelId) {
      ideStore.panelsManager.togglePanel(consoleTool.panelId, consoleTool.component)
    }

    ideStore.setStatusMessage('Chargement des outils externes...')
    await toolManager.loadTools()
    await toolManager.registerExternalTools(externalTools)
    
    if (authStore.isAuthenticated && authStore.currentUser) {
      try {
        await ideStore.restoreUserLayout(authStore.currentUser)
      } catch (layoutError) {
        console.warn('App: Failed to restore user layout:', layoutError)
      }
    }
    
    ideStore.setStatusMessage('IDE pret')
  })()
  
  $effect(() => {
    const panelsManager = ideStore.panelsManager
    if (panelsManager) {
      const updateZoneStates = () => {
        hasTopLeft = panelsManager.hasActivePanelsInPosition('topLeft')
        hasBottomLeft = panelsManager.hasActivePanelsInPosition('bottomLeft')
        hasTopRight = panelsManager.hasActivePanelsInPosition('topRight')
        hasBottomRight = panelsManager.hasActivePanelsInPosition('bottomRight')
        hasBottom = panelsManager.hasActivePanelsInPosition('bottom')
      }
      
      panelsManager.addChangeCallback(updateZoneStates)
      updateZoneStates()
    }
  })
</script>

<div class="app">
  <ContextMenu />
  <TitleBar />

  {#if authStore.isAuthenticated}
    <div class="main-container">
      <Toolbar position="left" />
      
      <div class="content-area">
        <div class="panels-wrapper">
          
          <div class="side-panel-container left" style:width="{leftPanelWidth}px" style:display="{hasTopLeft || hasBottomLeft ? 'flex' : 'none'}">
            <ToolPanel position="topLeft" />
            <ToolPanel position="bottomLeft" />
          </div>
          
          {#if hasTopLeft || hasBottomLeft}
            <ResizeHandle direction="vertical" onResizeStart={createResizeLogic('left')} onKeyboardAdjust={adjustLeftPanel} />
          {/if}
          
          <MainViewSplit />
          
          {#if hasTopRight || hasBottomRight}
            <ResizeHandle direction="vertical" onResizeStart={createResizeLogic('right')} onKeyboardAdjust={adjustRightPanel} />
          {/if}
          
          <div class="side-panel-container right" style:width="{rightPanelWidth}px" style:display="{hasTopRight || hasBottomRight ? 'flex' : 'none'}">
            <ToolPanel position="topRight" />
            <ToolPanel position="bottomRight" />
          </div>
        </div>
        
        {#if hasBottom}
          <ResizeHandle direction="horizontal" onResizeStart={createResizeLogic('bottom')} onKeyboardAdjust={adjustBottomPanel} />
          <div class="bottom-panel-container" style:height="{bottomPanelHeight}px">
            <ToolPanel position="bottom" />
          </div>
        {/if}
      </div>
      
      <Toolbar position="right" />
    </div>
    
    <StatusBar />
  {:else}
    <WelcomeScreen />
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
</style>
