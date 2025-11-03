import { ideStore } from '@/stores/ideStore.svelte.js'
import { panelsManager } from '@/core/PanelsManager.svelte.js'
import { focusDisplayCoordinator } from '@/core/FocusDisplayCoordinator.svelte.js'
import { toolFocusCoordinator } from '@/core/ToolFocusCoordinator.svelte.js'
import { mainMenuService } from '@/core/MainMenuService.svelte.js'

class ToolManagerSvelte {
  constructor() {
    this.registeredTools = new Map()
    focusDisplayCoordinator.setPanelsManagerAccessor(() => ideStore.panelsManager ?? panelsManager)
    toolFocusCoordinator.setFocusHandler((toolId, tab, options = {}) => {
      this._handleFocusedTab(toolId, tab, options)
    })
  }

  registerTool(tool) {
    if (this.registeredTools.has(tool.id)) {
      return
    }

    mainMenuService.unregisterOwner(tool.id)
    this.registeredTools.set(tool.id, tool)
    tool.initialize()
    this._registerTool(tool)
    ideStore.addTool(tool)
    toolFocusCoordinator.registerTool(tool)
  }

  _registerTool(tool) {
    const manager = ideStore.panelsManager
    if (!manager || !tool.component) {
      return
    }

    const prefix = tool.name === 'Console' ? 'console-' : 'tool-'
    const panelId = prefix + tool.id
    const position = tool.name === 'Console' ? 'bottom' : tool.position
    tool.panelId = panelId

    manager.registerPanel({
      id: panelId,
      position,
      persistent: true,
      title: tool.name,
      icon: tool.icon,
      component: tool.component,
      toolId: tool.id,
      tool
    })
  }

  unregisterTool(toolId) {
    const tool = this.registeredTools.get(toolId)
    if (!tool) {
      ideStore.addLog(`Tool ${toolId} not found`, 'warning')
      return
    }

    tool.destroy()
    ideStore.removeTool(toolId)
    mainMenuService.unregisterOwner(toolId)
    this.registeredTools.delete(toolId)
    ideStore.addLog(`Tool ${tool.name} unregistered`, 'info')
    toolFocusCoordinator.unregisterTool(toolId)
  }

  async registerExternalTools(entries) {
    if (!entries) {
      return
    }

    const list = Array.isArray(entries) ? entries : [entries]

    for (const entry of list) {
      if (!entry) {
        continue
      }

      let candidate = entry
      if (typeof candidate === 'function') {
        candidate = candidate(this)
      }

      if (candidate && typeof candidate.then === 'function') {
        candidate = await candidate
      }

      if (!candidate) {
        continue
      }

      if (typeof candidate.register === 'function') {
        const result = candidate.register(this)
        if (result && typeof result.then === 'function') {
          await result
        }
        continue
      }

      if (candidate.id && candidate.name) {
        this.registerTool(candidate)
      }
    }
  }

  getTool(toolId) {
    if (!toolId) {
      return null
    }
    return this.registeredTools.get(toolId) || null
  }

  _handleFocusedTab(toolId, tab, { isPrimary = false } = {}) {
    const tool = this.getTool(toolId)
    if (!tool) {
      return
    }

    focusDisplayCoordinator.handleFocus(tool, tab, { isPrimary })
  }
}

export const toolManager = new ToolManagerSvelte()
