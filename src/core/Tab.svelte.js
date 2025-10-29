import { SCROLL_MODES } from '@/core/ScrollModes.svelte.js'

export class Tab {
  constructor(id, title, component, closable = true, icon = null, scrollMode = SCROLL_MODES.ide) {
    this.id = id
    this.title = title
    this.component = component
    this.closable = closable
    this.icon = icon
    this.modified = (false)
    this.scrollMode = scrollMode
    this.descriptor = null
  }

  setModified(modified) {
    this.modified = modified
  }

  setDescriptor(descriptor) {
    this.descriptor = descriptor
  }

  getSerializableData() {
    return {
      id: this.id,
      title: this.title,
      closable: this.closable,
      icon: this.icon,
      descriptor: this.descriptor,
      scrollMode: this.scrollMode
    }
  }
}
