import { panelsManager as defaultPanelsManager } from '@/core/PanelsManager.svelte.js'

class FocusDisplayCoordinator {
  constructor() {
    this._panelsManagerAccessor = () => defaultPanelsManager
  }

  setPanelsManagerAccessor(accessor) {
    if (typeof accessor === 'function') {
      this._panelsManagerAccessor = accessor
    }
  }

  handleFocus(tool, tab, options = {}) {
    const manager = this._resolvePanelsManager()
    if (!manager || !tool || !tool.panelId) {
      return
    }

    const panel = manager.getPanel ? manager.getPanel(tool.panelId) : null
    if (!panel) {
      return
    }

    const position = panel.position ?? tool.position
    if (!position) {
      return
    }

    const activePanel = manager.getActivePanelByPosition
      ? manager.getActivePanelByPosition(position)
      : null

    if (!activePanel) {
      // Aucun panneau affiché pour cette position : ne pas modifier l'état ouvert/fermé.
      return
    }

    if (activePanel.id === panel.id) {
      return
    }

    const component = panel.component ?? tool.component
    manager.activatePanel(panel.id, component, { focus: false })
  }

  _resolvePanelsManager() {
    try {
      return this._panelsManagerAccessor ? this._panelsManagerAccessor() : null
    } catch {
      return null
    }
  }
}

export const focusDisplayCoordinator = new FocusDisplayCoordinator()
