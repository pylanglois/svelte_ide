import { eventBus } from '@/core/EventBusService.svelte.js'
import { stateProviderService } from '@/core/StateProviderService.svelte.js'
import { persistenceRegistry } from '@/core/persistence/PersistenceRegistry.svelte.js'
import { createLogger } from '@/lib/logger.js'
import { explorerStore } from './explorerStore.svelte.js'

const logger = createLogger('test-tools/explorer/persistence')

const DEFAULT_STATE = {
  selectedItem: null,
  recentFiles: []
}
const MAX_RECENTS = 8

function normalizeFileName(name) {
  if (!name || typeof name !== 'string') {
    return null
  }
  return name.trim()
}

class ExplorerPersistenceService {
  constructor() {
    // Démarrer avec l'état par défaut et loaded=true
    // L'état réel sera restauré via restoreState() appelé par StateProviderService
    this.state = $state({
      ...DEFAULT_STATE,
      loaded: true
    })
    this.persister = persistenceRegistry.createPersister('tool-explorer', 'json', {
      storeName: 'tool-explorer'
    })

    stateProviderService.registerProvider('tool-explorer', this)
    this.hasRestoredOnce = false
  }

  async _persist() {
    try {
      await this.persister.save('state', this.saveState())
    } catch (error) {
      logger.warn('ExplorerPersistence: failed to persist state', error)
    }
  }

  _computeRecents(nextItem) {
    const normalized = normalizeFileName(nextItem)
    if (!normalized) {
      return [...this.state.recentFiles]
    }

    const withoutItem = this.state.recentFiles.filter(entry => entry !== normalized)
    const updated = [normalized, ...withoutItem]
    return updated.slice(0, MAX_RECENTS)
  }

  async setSelectedItem(itemName) {
    const normalized = normalizeFileName(itemName)
    if (this.state.selectedItem === normalized) {
      return
    }

    this.state = {
      ...this.state,
      selectedItem: normalized,
      recentFiles: this._computeRecents(normalized)
    }

    await this._persist()
  }

  saveState() {
    return {
      selectedItem: this.state.selectedItem,
      recentFiles: this.state.recentFiles,
      fileContents: explorerStore.getAllContents(),
      fileOriginalContents: explorerStore.getAllOriginalContents()
    }
  }

  async restoreState(restoredState) {
    logger.log('[ExplorerPersistence] restoreState called', {
      hasData: !!restoredState,
      hasFileContents: !!(restoredState?.fileContents)
    })
    
    const normalized = {
      ...DEFAULT_STATE,
      ...(restoredState ?? {})
    }
    this.state = {
      ...normalized,
      loaded: true
    }
    
    // Restaurer les contenus de fichiers dans explorerStore
    if (restoredState?.fileContents || restoredState?.fileOriginalContents) {
      logger.log('[ExplorerPersistence] Restoring explorerStore contents')
      explorerStore.restoreAllContents(
        restoredState.fileContents ?? {},
        restoredState.fileOriginalContents ?? {}
      )
    }
    
    await this._persist()
    
    this.hasRestoredOnce = true
    
    // Publier l'événement pour notifier que l'état est restauré
    logger.log('[ExplorerPersistence] Publishing explorer:state-restored')
    eventBus.publish('explorer:state-restored', { 
      state: this.state,
      hasRestoredContent: !!(restoredState?.fileContents)
    })
  }
}

export const explorerPersistence = new ExplorerPersistenceService()
