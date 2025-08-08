import { ideStore } from '@/stores/ideStore.svelte.js'

class ToolManagerSvelte {
  constructor() {
    this.registeredTools = new Map()
  }

  registerTool(tool) {
    if (this.registeredTools.has(tool.id)) {
      return
    }

    this.registeredTools.set(tool.id, tool)
    tool.initialize()
    
    // NOUVEAU : Enregistrement direct dans le nouveau système
    this._registerToolInNewSystem(tool)
    
    ideStore.addTool(tool)
  }
  
  _registerToolInNewSystem(tool) {
    const panelsManager = ideStore.panelsManager
    if (!panelsManager || !tool.component) return
    
    // Mapper les outils système spéciaux
    if (tool.name === 'Console') {
      // Console va en bottom
      panelsManager.registerPanel({
        id: `console-${tool.id}`,
        position: 'bottom',
        persistent: true,
        title: tool.name,
        icon: tool.icon,
        component: tool.component,
        toolId: tool.id
      })
    } else {
      // Autres outils selon leur position
      panelsManager.registerPanel({
        id: `tool-${tool.id}`,
        position: tool.position,
        persistent: true,
        title: tool.name,
        icon: tool.icon,
        component: tool.component,
        toolId: tool.id
      })
    }
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
