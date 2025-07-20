import { Tool } from '@/core/Tool.svelte.js'
import ExplorerWrapper from '@tools/explorer2/ExplorerWrapper.svelte'
import MetadataPanel from '@tools/explorer2/MetadataPanel.svelte'

class MetadataV2Tool extends Tool {
  constructor() {
    super('Métadonnées V2', '🔍', 'topRight')
  }

  initialize() {
    this.setComponent(MetadataPanel)
  }

  destroy() {
    super.destroy()
  }
}

class ExplorerV2Tool extends Tool {
  constructor() {
    super('Explorateur V2', '🔍', 'topLeft')
  }

  initialize() {
    this.setComponent(ExplorerWrapper, { toolId: this.id })
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
    toolManager.registerTool(explorerTool)
    toolManager.registerTool(metadataV2Tool)
  }
}

export { MetadataV2Tool }
