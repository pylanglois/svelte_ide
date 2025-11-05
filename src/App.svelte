<script>
  import { indexedDBService } from '@/core/persistence/IndexedDBService.svelte.js';
  import { toolManager } from '@/core/ToolManager.svelte.js';
  import { getAuthStore } from '@/stores/authStore.svelte.js';
  import { ideStore } from '@/stores/ideStore.svelte.js';

  import StatusBar from '@/components/layout/chrome/StatusBar.svelte';
  import TitleBar from '@/components/layout/chrome/TitleBar.svelte';
  import Toolbar from '@/components/layout/chrome/Toolbar.svelte';
  import ToolPanel from '@/components/layout/chrome/ToolPanel.svelte';
  import MainViewSplit from '@/components/layout/containers/MainViewSplit.svelte';
  import ResizeHandle from '@/components/layout/containers/ResizeHandle.svelte';
  import ContextMenu from '@/components/layout/ui/ContextMenu.svelte';
  import ModalHost from '@/components/layout/ui/ModalHost.svelte';
  import WelcomeScreen from '@/components/layout/ui/WelcomeScreen.svelte';
  import ReAuthModal from '@/components/system/ReAuthModal.svelte';

  const authStore = getAuthStore()

  // Synchroniser IndexedDBService avec authStore
  $effect(() => {
    if (authStore.encryptionKey) {
      indexedDBService.setEncryptionKey(authStore.encryptionKey)
      console.debug('App: IndexedDB encryption key synchronized')
    } else {
      indexedDBService.clearEncryptionKey()
      console.debug('App: IndexedDB encryption key cleared')
    }
  })

  function normalizeBranding(value) {
    if (!value) {
      return null
    }

    if (value.component || value.props) {
      return {
        component: value.component ?? null,
        props: value.props ?? {}
      }
    }

    if (value.logoComponent || value.logoProps) {
      return {
        component: value.logoComponent ?? null,
        props: value.logoProps ?? {}
      }
    }

    return null
  }

  let {
    externalTools = [],
    systemTools = [],
    statusMessages = {},
    branding = null
  } = $props()
  
  let resolvedBranding = $state(null)

  $effect(() => {
    resolvedBranding = normalizeBranding(branding)
  })

  if (import.meta.env.DEV) {
    $inspect('App resolvedBranding', resolvedBranding)
  }
  
  const {
    initializing: initializingStatus = '',
    systemTools: systemToolsStatus = '',
    externalTools: externalToolsStatus = '',
    ready: readyStatus = ''
  } = statusMessages ?? {}

  function registerToolResult(result) {
    if (!result) {
      return
    }

    const tools = Array.isArray(result) ? result : [result]
    for (const tool of tools) {
      if (!tool) {
        continue
      }
      try {
        toolManager.registerTool(tool)
      } catch (registrationError) {
        console.warn('App: failed to register system tool instance', registrationError)
      }
    }
  }

  async function registerSystemTools() {
    if (!systemTools || systemTools.length === 0) {
      return
    }

    if (systemToolsStatus) {
      ideStore.setStatusMessage(systemToolsStatus)
    }

    for (const entry of systemTools) {
      try {
        const result = typeof entry === 'function' ? await entry({ toolManager, ideStore }) : entry
        registerToolResult(result)
      } catch (error) {
        console.warn('App: system tool setup failed', error)
      }
    }
  }
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
    window.indexedDBService = indexedDBService // Pour tests manuels dans console

    try {
      if (initializingStatus) {
        ideStore.setStatusMessage(initializingStatus)
      }

      // Initialiser IndexedDB avec les stores de base
      try {
        await indexedDBService.initialize(['default', 'tools', 'layout', 'preferences'])
        console.debug('App: IndexedDB initialized successfully')
      } catch (idbError) {
        console.warn('App: IndexedDB initialization failed, data persistence may be limited', idbError)
        // Ne pas bloquer l'application, continuer sans IndexedDB
      }

      await authStore.initialize()

      await registerSystemTools()

      if (externalToolsStatus && Array.isArray(externalTools) && externalTools.length > 0) {
        ideStore.setStatusMessage(externalToolsStatus)
      }

      await toolManager.registerExternalTools(externalTools)

      if (authStore.isAuthenticated && authStore.currentUser) {
        try {
          await ideStore.restoreUserLayout(authStore.currentUser)
        } catch (layoutError) {
          console.warn('App: Failed to restore user layout:', layoutError)
        }
      }

      if (readyStatus) {
        ideStore.setStatusMessage(readyStatus)
      } else if (initializingStatus || systemToolsStatus || externalToolsStatus) {
        ideStore.setStatusMessage('')
      }
    } catch (bootstrapError) {
      console.error('App: bootstrap sequence failed', bootstrapError)
      ideStore.setStatusMessage('')
    }
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
  <ModalHost />

  {#if authStore.isAuthenticated}
    <TitleBar branding={resolvedBranding} />
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

<ReAuthModal />
