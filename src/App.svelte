<script>
  import { eventBus } from '@/core/EventBusService.svelte.js';
  import { binaryStorageService } from '@/core/persistence/BinaryStorageService.svelte.js';
  import { indexedDBService } from '@/core/persistence/IndexedDBService.svelte.js';
  import { storagePersistenceService } from '@/core/persistence/StoragePersistenceService.svelte.js';
  import { toolManager } from '@/core/ToolManager.svelte.js';
  import { getAuthStore } from '@/stores/authStore.svelte.js';
  import { ideStore } from '@/stores/ideStore.svelte.js';
  import { createLogger } from '@/lib/logger.js';

  import StatusBar from '@/components/layout/chrome/StatusBar.svelte';
  import TitleBar from '@/components/layout/chrome/TitleBar.svelte';
  import Toolbar from '@/components/layout/chrome/Toolbar.svelte';
  import ToolPanel from '@/components/layout/chrome/ToolPanel.svelte';
  import MainViewSplit from '@/components/layout/containers/MainViewSplit.svelte';
  import ResizeHandle from '@/components/layout/containers/ResizeHandle.svelte';
  import ContextMenu from '@/components/layout/ui/ContextMenu.svelte';
  import ModalHost from '@/components/layout/ui/ModalHost.svelte';
  import WelcomeScreen from '@/components/layout/ui/WelcomeScreen.svelte';

  const authStore = getAuthStore()
  const PERSISTENCE_READY_TIMEOUT_MS = 10000
  const appLogger = createLogger('app')

  // Synchroniser IndexedDBService avec authStore et attendre que la DB soit vraiment prête
  $effect(() => {
    const key = authStore.encryptionKey
    const encrypted = Boolean(key)
    
    appLogger.info('SALUT!!!')

    // Fonction async pour gérer l'attente de readyForEncryption
    const syncPersistence = async () => {
      if (encrypted) {
        indexedDBService.setEncryptionKey(key)
        binaryStorageService.setEncryptionKey(key)
        appLogger.debug('Encryption keys synchronized for persistence services')
        
        // ✅ ATTENDRE que IndexedDB soit vraiment prête avant de publier l'événement
        try {
          await indexedDBService.readyForEncryption({ timeoutMs: PERSISTENCE_READY_TIMEOUT_MS })
          appLogger.debug('IndexedDB ready for encryption, publishing persistence:ready')
        } catch (readyError) {
          appLogger.warn('IndexedDB readiness timeout, publishing persistence:ready anyway', readyError)
          eventBus.publish('persistence:error', {
            reason: 'timeout',
            error: readyError,
            timestamp: Date.now()
          })
        }
      } else {
        indexedDBService.clearEncryptionKey()
        binaryStorageService.clearEncryptionKey()
        appLogger.debug('Encryption keys cleared for persistence services')
      }
      
      // Publier l'événement seulement APRÈS que readyForEncryption() soit résolu ou timeout
      eventBus.publish('persistence:ready', {
        encrypted,
        services: {
          indexedDB: encrypted && Boolean(indexedDBService?.cipher?.enabled),
          binaryStorage: encrypted && Boolean(binaryStorageService?.cipher?.enabled)
        },
        timestamp: Date.now()
      })
    }
    
    syncPersistence()
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
        appLogger.warn('App: failed to register system tool instance', registrationError)
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
        appLogger.warn('App: system tool setup failed', error)
      }
    }
  }

  async function waitForPersistenceReady() {
    if (!authStore.isAuthenticated || !authStore.hasEncryptionKey) {
      await new Promise((resolve) => {
        const unsubscribe = eventBus.subscribe('persistence:ready', (payload) => {
          if (payload?.encrypted) {
            unsubscribe()
            resolve()
          }
        })
      })
    }
    try {
      await indexedDBService.readyForEncryption({
        timeoutMs: PERSISTENCE_READY_TIMEOUT_MS
      })
    } catch (readyError) {
      appLogger.warn('App: Persistence readiness check failed (continuing with degraded mode)', readyError)
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
    window.binaryStorageService = binaryStorageService
    window.storagePersistenceService = storagePersistenceService // Pour tests manuels dans console

    try {
      if (initializingStatus) {
        ideStore.setStatusMessage(initializingStatus)
      }

      // Initialiser IndexedDB avec les stores de base
      try {
        await indexedDBService.initialize(['default', 'tools', 'layout', 'preferences'])
        await binaryStorageService.initialize()
        appLogger.debug('App: Persistence services initialized successfully')

        // ✅ DEMANDER LA PERSISTANCE DURABLE pour protéger contre l'éviction automatique
        // Par défaut activé sauf si explicitement désactivé via VITE_STORAGE_PERSISTENCE_REQUEST=false
        const envValue = import.meta.env.VITE_STORAGE_PERSISTENCE_REQUEST
        const requestPersistence = envValue === undefined || envValue === 'true' || envValue === true
        if (requestPersistence && storagePersistenceService.isSupported()) {
          const granted = await storagePersistenceService.requestPersistence()
          if (granted) {
            appLogger.log('✅ App: Persistent storage granted - Data protected from automatic eviction')
            ideStore.addNotification({
              type: 'success',
              message: 'Vos données sont protégées contre la suppression automatique',
              duration: 5000
            })
          } else {
            appLogger.warn('⚠️ App: Persistent storage denied - Data may be evicted under storage pressure')
            ideStore.addNotification({
              type: 'warning',
              message: 'Avertissement : Vos données peuvent être supprimées automatiquement par le navigateur. Ajoutez ce site à vos favoris pour éviter la perte de données.',
              duration: 15000
            })
          }
        } else if (!requestPersistence) {
          appLogger.warn('⚠️ App: Storage persistence request disabled via VITE_STORAGE_PERSISTENCE_REQUEST=false')
        } else {
          appLogger.warn('⚠️ App: Storage Persistence API not supported in this browser')
        }
      } catch (idbError) {
        appLogger.warn('App: Persistence initialization failed, data persistence may be limited', idbError)
        // Ne pas bloquer l'application, continuer sans IndexedDB
      }

      await authStore.initialize()

      await waitForPersistenceReady()

      await registerSystemTools()

      if (externalToolsStatus && Array.isArray(externalTools) && externalTools.length > 0) {
        ideStore.setStatusMessage(externalToolsStatus)
      }

      await toolManager.registerExternalTools(externalTools)

      if (readyStatus) {
        ideStore.setStatusMessage(readyStatus)
      } else if (initializingStatus || systemToolsStatus || externalToolsStatus) {
        ideStore.setStatusMessage('')
      }
    } catch (bootstrapError) {
      appLogger.error('App: bootstrap sequence failed', bootstrapError)
      ideStore.setStatusMessage('')
    }
  })()
  
  let layoutRestoreInProgress = false

  async function ensureUserLayoutRestored() {
    if (layoutRestoreInProgress) {
      return
    }
    if (!authStore.isAuthenticated || !authStore.currentUser) {
      return
    }

    layoutRestoreInProgress = true
    try {
      await ideStore.restoreUserLayout(authStore.currentUser)
    } catch (layoutError) {
      appLogger.warn('App: Failed to restore user layout:', layoutError)
    } finally {
      layoutRestoreInProgress = false
    }
  }

  $effect(() => {
    ensureUserLayoutRestored()
  })

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
