import { LeftTool, RightTool } from '../../core/Tool.svelte.js'
import ExplorerWrapper from './ExplorerWrapper.svelte'
import MetadataPanel from './MetadataPanel.svelte'

class MetadataV2Tool extends RightTool {
  constructor() {
    super('metadata-v2', 'Métadonnées V2', '🔍')
  }

  initialize() {
    this.setComponent(MetadataPanel)
  }

  updateVisibility(activeTabId) {
    if (activeTabId && activeTabId.startsWith('explorer2-')) {
      this.shouldBeVisible = true
    } else {
      this.shouldBeVisible = false
    }
  }

  destroy() {
    super.destroy()
  }
}

class ExplorerV2Tool extends LeftTool {
  constructor() {
    super('explorer2', 'Explorateur V2', '🔍')
  }

  initialize() {
    this.setComponent(ExplorerWrapper, { toolId: this.id })
  }

  updateVisibility(activeTabId) {
    // Les explorateurs gardent leur état manuel - pas de gestion automatique
    // Ne pas changer shouldBeVisible, laisser le toggle manuel
  }

  isMyTab(tabId) {
    return tabId.startsWith(`${this.id}-`)
  }

  destroy() {
    super.destroy()
  }
}

const explorerTool = new ExplorerV2Tool()
const metadataV2Tool = new MetadataV2Tool()

explorerTool.files = [
  { name: 'document.txt', type: 'file', content: 'Contenu du document V2' },
  { name: 'image.jpg', type: 'file', content: 'Image V2' },
  { name: 'dossier-projets', type: 'folder' },
  { name: 'config.json', type: 'file', content: '{"version": "2.0"}' }
]

export default {
  register(toolManager) {
    explorerTool.setToolManager(toolManager)
    toolManager.registerTool(explorerTool)
    
    metadataV2Tool.setToolManager(toolManager)
    toolManager.registerTool(metadataV2Tool)
  }
}

export { MetadataV2Tool }
