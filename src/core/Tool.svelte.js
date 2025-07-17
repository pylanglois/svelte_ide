export class Tool {
  constructor(id, name, icon, position = 'left') {
    this.id = id
    this.name = name
    this.icon = icon
    this.position = position
    // this.active = $state(false)
    // this.shouldBeVisible = $state(false)
    this.component = null
    this.componentProps = {}
    // this.wasActiveBeforeUnregister = false
    // this.toolManager = null
  }

  setComponent(component, props = {}) {
    this.component = component
    this.componentProps = props
  }

  // activate() {
  //   this.active = true
  //   this.shouldBeVisible = true // Synchroniser avec l'activation manuelle
  //   this.wasActiveBeforeUnregister = false // Reset quand activé manuellement
  // }
  //
  // deactivate() {
  //   this.active = false
  //   this.shouldBeVisible = false // Synchroniser avec la désactivation
  // }

  // Méthode pour déterminer si l'outil devrait être visible selon le contexte
  updateVisibility(activeTabId) {
    // Par défaut, ne change pas la visibilité
    // Les sous-classes peuvent redéfinir cette méthode
  }

  // setToolManager(toolManager) {
  //   this.toolManager = toolManager
  // }

  initialize() {
  }

  destroy() {
  }
}

export class LeftTool extends Tool {
  constructor(id, name, icon) {
    super(id, name, icon, 'left')
  }
}

export class RightTool extends Tool {
  constructor(id, name, icon) {
    super(id, name, icon, 'right')
  }
}

export class Tab {
  constructor(id, title, component, closable = true, toolIcon = null) {
    this.id = id
    this.title = title
    this.component = component
    this.closable = closable
    this.modified = false
    this.toolIcon = toolIcon
  }

  setModified(modified) {
    this.modified = modified
  }
}
