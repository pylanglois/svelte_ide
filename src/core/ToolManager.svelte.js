import { ideStore } from '../stores/ideStore.svelte.js'

class ToolManagerSvelte {
  constructor() {
    this.registeredTools = new Map()
  }

  registerTool(tool) {
    if (this.registeredTools.has(tool.id)) {
      return
    }

    this.registeredTools.set(tool.id, tool)
    
    tool.setToolManager(this)
    tool.initialize()
    
    const shouldRestore = tool.restoreActiveState()
    
    if (tool.position === 'left') {
      ideStore.addLeftTool(tool)
      if (shouldRestore) {
        ideStore.toggleLeftPanel(tool.id)
      }
    } else if (tool.position === 'right') {
      ideStore.addRightTool(tool)
      if (shouldRestore) {
        ideStore.toggleRightPanel(tool.id)
      }
    }
  }

  unregisterTool(toolId) {
    const tool = this.registeredTools.get(toolId)
    if (!tool) {
      ideStore.addLog(`Tool ${toolId} not found`, 'warning')
      return
    }

    tool.saveActiveState()
    tool.destroy()
    
    if (tool.position === 'left') {
      ideStore.removeLeftTool(toolId)
    } else if (tool.position === 'right') {
      ideStore.removeRightTool(toolId)
    }

    this.registeredTools.delete(toolId)
    ideStore.addLog(`Tool ${tool.name} unregistered`, 'info')
  }

  getTool(toolId) {
    return this.registeredTools.get(toolId)
  }

  getAllTools() {
    return Array.from(this.registeredTools.values())
  }

  async loadTools() {
    try {
      const toolModules = import.meta.glob('../tools/**/index.svelte.js')
      
      for (const path in toolModules) {
        try {
          const module = await toolModules[path]()
          if (module.default) {
            if (typeof module.default.register === 'function') {
              module.default.register(this)
            } 
            else if (module.default.id && module.default.name) {
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
}

export const toolManager = new ToolManagerSvelte()
