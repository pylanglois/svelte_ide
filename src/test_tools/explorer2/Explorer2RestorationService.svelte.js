import { eventBus } from '@/core/EventBusService.svelte.js'
import { ideStore } from '@/stores/ideStore.svelte.js'
import FileViewer from './FileViewer.svelte'

class Explorer2RestorationService {
  constructor() {
    this.init()
  }

  init() {
    eventBus.subscribe('tab:hydrate', (hydrateEvent) => {
      if (hydrateEvent.descriptor.type === 'file-editor' && 
          hydrateEvent.descriptor.resourceId.startsWith('V2:')) {
        this.handleHydrate(hydrateEvent)
      }
    })
  }

  handleHydrate(hydrateEvent) {
    const { descriptor, tabId, hydrateCallback, userId } = hydrateEvent
    
    try {
      const realFileName = descriptor.resourceId.replace('V2: ', '')
      const content = this._getFileContent(realFileName)
      
      hydrateCallback(FileViewer, {
        content: content
      })
      
    } catch (error) {
      console.error('Erreur hydratation fichier V2:', error)
    }
  }

  _getFileContent(fileName) {
    // Même source de données mais avec contenu V2
    const mockFiles = [
      { name: 'demo1.txt', content: 'Contenu V2 du fichier demo1.txt\nLigne 2 V2\nLigne 3 V2' },
      { name: 'demo2.md', content: '# Fichier Markdown V2\n\nCeci est un **fichier markdown V2**.' },
      { name: 'demo3.js', content: 'console.log("Hello from demo3.js V2");\nfunction testV2() {\n  return "test V2";\n}' }
    ]
    
    const fileData = mockFiles.find(file => file.name === fileName)
    return fileData ? fileData.content : 'Contenu par défaut V2'
  }
}

export const explorer2RestorationService = new Explorer2RestorationService()
