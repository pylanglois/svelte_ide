import { eventBus } from '@/core/EventBusService.svelte.js'

class ToolFocusCoordinator {
  constructor() {
    this._registeredToolIds = new Set()
    this._focusHandler = null

    eventBus.subscribe('tabs:focus-changed', ({ tab }) => {
      this._handleTabFocus(tab)
    })
  }

  setFocusHandler(handler) {
    this._focusHandler = typeof handler === 'function' ? handler : null
  }

  registerTool(tool) {
    if (!tool || !tool.id) {
      return
    }
    this._registeredToolIds.add(tool.id)
  }

  unregisterTool(toolId) {
    if (!toolId) {
      return
    }
    this._registeredToolIds.delete(toolId)
  }

  _handleTabFocus(tab) {
    if (!this._focusHandler || !tab) {
      return
    }

    const toolId = tab.toolId
    if (!toolId) {
      return
    }

    if (!this._registeredToolIds.has(toolId)) {
      return
    }

    this._focusHandler(toolId, tab)
  }
}

export const toolFocusCoordinator = new ToolFocusCoordinator()
