export class Tool {
  constructor(name, icon, position = 'topLeft') {
    this.id = crypto.randomUUID()
    this.name = name
    this.icon = icon
    this.position = $state(position) // topLeft, bottomLeft, topRight, bottomRight, bottom
    this.active = $state(false)
    this.component = null
    this.componentProps = {}
  }

  setComponent(component, props = {}) {
    this.component = component
    this.componentProps = props
  }

  setPosition(newPosition) {
    this.position = newPosition
  }

  activate() {
    this.active = true
  }

  deactivate() {
    this.active = false
  }

  initialize() {
  }

  destroy() {
  }
}

export class Tab {
  constructor(id, title, component, closable = true, icon = null) {
    this.id = id
    this.title = title
    this.component = component
    this.closable = closable
    this.icon = icon
    this.modified = false
  }

  setModified(modified) {
    this.modified = modified
  }
}
