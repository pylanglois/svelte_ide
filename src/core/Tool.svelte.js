export class Tool {
  constructor(name, icon, position = 'topLeft', id = null) {
    this.id = id ?? Tool.generate_id(name)
    this.name = name
    this.icon = icon
    this.position = $state(position)
    this.active = $state(false)
    this.component = null
    this.componentProps = {}
  }

  static generate_id(source) {
    if (!source) {
      return crypto.randomUUID()
    }
    const value = source.toString().trim().toLowerCase().normalize('NFD')
    const cleaned = value.replace(/[\u0300-\u036f]/g, '')
    const sanitized = cleaned.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
    return sanitized || crypto.randomUUID()
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
