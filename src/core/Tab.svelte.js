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