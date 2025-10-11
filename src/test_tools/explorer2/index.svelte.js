import { Tool } from '@/core/Tool.svelte.js'
import ExplorerWrapper from './ExplorerWrapper.svelte'
import MetadataPanel from './MetadataPanel.svelte'
// Import du service de restauration pour l'auto-enregistrement
import './Explorer2RestorationService.svelte.js'

class MetadataV2Tool extends Tool {
  constructor() {
    super('Métadonnées V2', '🔍', 'topRight', 'explorer2-metadata')
  }

  initialize() {
    this.setComponent(MetadataPanel)
  }

  destroy() {
    super.destroy()
  }
}

export class Explorer2Tool extends Tool {
  constructor(id, position) {
    super('Explorateur V2', '🗂️', position, id)
    this.setComponent(ExplorerWrapper, { toolId: id })
  }
}

class Explorer2MainTool extends Tool {
  constructor() {
    super('Explorateur V2', '🔍', 'topLeft', 'explorer2')
  }

  initialize() {
    this.setComponent(ExplorerWrapper, { toolId: this.id })
  }

  destroy() {
    super.destroy()
  }
}

const explorerTool = new Explorer2MainTool()
const metadataV2Tool = new MetadataV2Tool()

explorerTool.files = [
  { name: 'document.txt', type: 'file', content: 'Contenu du document V2' },
  { name: 'image.jpg', type: 'file', content: 'Image V2' },
  { name: 'dossier-projets', type: 'folder' },
  { name: 'config.json', type: 'file', content: '{"version": "2.0"}' }
]

export default {
  register(toolManager) {
    toolManager.registerTool(explorerTool)
    toolManager.registerTool(metadataV2Tool)
  }
}

export { MetadataV2Tool }

