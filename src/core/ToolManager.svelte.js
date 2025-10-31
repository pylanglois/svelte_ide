import { ideStore } from '@/stores/ideStore.svelte.js'
import { panelsManager } from '@/core/PanelsManager.svelte.js'
import { toolFocusCoordinator } from '@/core/ToolFocusCoordinator.svelte.js'

class ToolManagerSvelte {
  constructor() {
    this.registeredTools = new Map()
    toolFocusCoordinator.setFocusHandler((toolId, tab) => {
      this._handleFocusedTab(toolId, tab)
    })
  }

  registerTool(tool) {
    if (this.registeredTools.has(tool.id)) {
      return
    }

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

  async loadTools() {
    try {
      const rawRoot = import.meta.env.VITE_TOOL_ROOT
      if (!rawRoot) {
        return
      }
      let normalizedRoot = rawRoot.trim()
      if (!normalizedRoot) {
        return
      }
      if (normalizedRoot.startsWith('./')) {
        normalizedRoot = normalizedRoot.slice(2)
      }
      if (normalizedRoot.startsWith('src/')) {
        normalizedRoot = normalizedRoot.slice(4)
      }
      if (!normalizedRoot.startsWith('../')) {
        normalizedRoot = `../${normalizedRoot}`
      }
      if (!normalizedRoot.endsWith('/')) {
        normalizedRoot = `${normalizedRoot}/`
      }

      const toolModules = import.meta.glob('../**/index.svelte.js')

      for (const path in toolModules) {
        if (!path.startsWith(normalizedRoot)) {
          continue
        }
        try {
          const module = await toolModules[path]()
          if (module.default) {
            if (typeof module.default.register === 'function') {
              module.default.register(this)
            } else if (module.default.id && module.default.name) {
              this.registerTool(module.default)
            }
          }
        } catch (error) {
          console.error(`Failed to load tool from ${path}:`, error)
        }
      }
    } catch (error) {
      console.error('Failed to load tools:', error)
    }
  }

  getTool(toolId) {
    if (!toolId) {
      return null
    }
    return this.registeredTools.get(toolId) || null
  }

  _handleFocusedTab(toolId, tab) {
    const tool = this.getTool(toolId)
    if (!tool || !tool.panelId) {
      return
    }

    const manager = ideStore.panelsManager ?? panelsManager
    if (!manager) {
      return
    }

    const panel = manager.getPanel ? manager.getPanel(tool.panelId) : null
    if (!panel) {
      return
    }

    if (!panel.isActive) {
      const component = panel.component ?? tool.component
      manager.activatePanel(panel.id, component)
    }
    manager.focusPanel(panel.id)
  }
}

export const toolManager = new ToolManagerSvelte()
