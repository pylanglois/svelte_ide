import { eventBus } from '@/core/EventBusService.svelte.js'
import { createLogger } from '@/lib/logger.js'
import { explorerStore } from './explorerStore.svelte.js'
import { getFileContent } from './fileService.svelte.js'
import FileViewer from './FileViewer.svelte'

const logger = createLogger('test-tools/explorer/restoration')

class ExplorerRestorationService {
  constructor() {
    this.stateRestored = false
    this.pendingHydrations = []
    
    logger.log('[ExplorerRestoration] Service initialized')
    
    // S'abonner à l'événement de restauration d'état
    eventBus.subscribe('explorer:state-restored', ({ hasRestoredContent }) => {
      logger.log('[ExplorerRestoration] State restored event received', { hasRestoredContent })
      this.stateRestored = true
      
      // Traiter toutes les hydratations en attente
      const pending = [...this.pendingHydrations]
      this.pendingHydrations = []
      
      logger.log('[ExplorerRestoration] Processing pending hydrations', { count: pending.length })
      
      pending.forEach(hydrationFn => {
        try {
          hydrationFn()
        } catch (error) {
          logger.error('Explorer: erreur lors de l\'hydratation différée', error)
        }
      })
    })
    
    // S'abonner aux événements d'hydratation de tabs
    eventBus.subscribe('tab:hydrate', (hydrateEvent) => {
      logger.log('[ExplorerRestoration] tab:hydrate received (all)', hydrateEvent.descriptor)
      
      if (hydrateEvent.descriptor.type === 'file-editor' && 
          hydrateEvent.descriptor.toolId === 'explorer') {
        
        logger.log('[ExplorerRestoration] tab:hydrate matched for explorer', {
          fileName: hydrateEvent.descriptor.resourceId,
          stateRestored: this.stateRestored
        })
        
        if (this.stateRestored) {
          // État déjà restauré, hydrater immédiatement
          logger.log('[ExplorerRestoration] Calling handleHydrate immediately')
          void this.handleHydrate(hydrateEvent)
        } else {
          // État pas encore restauré, mettre en file d'attente
          logger.log('[ExplorerRestoration] Queueing hydration')
          this.pendingHydrations.push(() => this.handleHydrate(hydrateEvent))
        }
      }
    })
  }

  async handleHydrate(hydrateEvent) {
    logger.log('[ExplorerRestoration] handleHydrate ENTERED', hydrateEvent.descriptor)
    
    const { descriptor, tabId, hydrateCallback, userId } = hydrateEvent
    const fileName = descriptor.resourceId
    
    logger.log('[ExplorerRestoration] handleHydrate processing', { fileName })
    
    try {
      // Essayer d'abord d'utiliser le contenu en cache depuis explorerStore
      let content = explorerStore.getFileContent(fileName)
      
      logger.log('[ExplorerRestoration] Cache lookup result', {
        fileName,
        hasCache: content !== null,
        contentPreview: content?.substring(0, 50) ?? 'null'
      })
      
      if (content === null) {
        // Fallback : charger depuis le service de fichiers
        logger.log('[ExplorerRestoration] Loading from fileService')
        content = await getFileContent(fileName)
      }

      logger.log('[ExplorerRestoration] About to call hydrateCallback', {
        hasCallback: !!hydrateCallback,
        contentLength: content?.length ?? 0
      })

      hydrateCallback(FileViewer, {
        content: content,
        fileName: fileName
      })
      
      logger.log('[ExplorerRestoration] Hydration completed successfully')
      logger.log('[ExplorerRestoration] Verifying tab was hydrated via ideStore')
      
      // Vérifier que le tab a bien été hydraté
      import('@/stores/ideStore.svelte.js').then(({ ideStore }) => {
        const tab = ideStore.tabs.find(t => t.fileName === fileName)
        logger.log('[ExplorerRestoration] Tab verification', {
          found: !!tab,
          hasComponent: !!(tab?.component),
          contentLength: tab?.content?.length ?? 0
        })
      })
      
    } catch (error) {
      logger.error('[ExplorerRestoration] ERROR during hydration', error)
      
      // Hydrater quand même avec un contenu vide pour éviter un tab cassé
      hydrateCallback(FileViewer, {
        content: '',
        fileName: fileName
      })
    }
  }
}

export const explorerRestorationService = new ExplorerRestorationService()
