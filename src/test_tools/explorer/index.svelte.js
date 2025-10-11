import { Tool } from '@/core/Tool.svelte.js'
import ExplorerWrapper from './ExplorerWrapper.svelte'
import MetadataPanel from './MetadataPanel.svelte'
// Import du service de restauration pour l'auto-enregistrement
import './ExplorerRestorationService.svelte.js'

class MetadataTool extends Tool {
  constructor() {
    super('Métadonnées', '📋', 'topRight', 'explorer-metadata')
  }

  initialize() {
    this.setComponent(MetadataPanel)
  }

  destroy() {
    super.destroy()
  }
}

export class ExplorerTool extends Tool {
  constructor(id, position) {
    super('Explorateur', '📁', position, id)
    this.setComponent(ExplorerWrapper, { toolId: id })
  }
}

class ExplorerMainTool extends Tool {
  constructor() {
    super('Explorateur', '📁', 'topLeft', 'explorer')
  }

  initialize() {
    this.setComponent(ExplorerWrapper, { toolId: this.id })
  }

  destroy() {
    super.destroy()
  }
}

export default {
  register(toolManager) {
    const explorerTool = new ExplorerMainTool()
    const metadataTool = new MetadataTool()

    toolManager.registerTool(explorerTool)
    toolManager.registerTool(metadataTool)
  }
}

export { MetadataTool }

