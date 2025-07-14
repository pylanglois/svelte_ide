import { LeftTool, RightTool } from '../../core/Tool.svelte.js'
import ExplorerWrapper from './ExplorerWrapper.svelte'
import MetadataPanel from './MetadataPanel.svelte'

class MetadataTool extends RightTool {
  constructor() {
    super('metadata', 'Métadonnées', '📋')
  }

  initialize() {
    this.setComponent(MetadataPanel)
  }

  updateVisibility(activeTabId) {
    if (activeTabId && activeTabId.startsWith('explorer-')) {
      this.shouldBeVisible = true
    } else {
      this.shouldBeVisible = false
    }
  }

  destroy() {
    super.destroy()
  }
}

class ExplorerTool extends LeftTool {
  constructor() {
    super('explorer', 'Explorateur', '📁')
  }

  initialize() {
    this.setComponent(ExplorerWrapper, { toolId: this.id })
  }

  updateVisibility(activeTabId) {
    // Les explorateurs gardent leur état manuel - pas de gestion automatique
    // Ne pas changer shouldBeVisible, laisser le toggle manuel
  }

  destroy() {
    super.destroy()
  }
}

export default {
  register(toolManager) {
    const explorerTool = new ExplorerTool()
    const metadataTool = new MetadataTool()
    
    explorerTool.setToolManager(toolManager)
    toolManager.registerTool(explorerTool)
    
    metadataTool.setToolManager(toolManager)
    toolManager.registerTool(metadataTool)
  }
}

export { MetadataTool }
