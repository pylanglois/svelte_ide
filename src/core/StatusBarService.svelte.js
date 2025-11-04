class StatusBarService {
  constructor() {
    this.sections = $state({
      left: [],
      center: [],
      right: []
    })
  }

  getItems(position) {
    const zone = this._normalizePosition(position)
    if (!zone) {
      return []
    }
    return this.sections[zone] ?? []
  }

  registerItem(position, itemConfig = {}, ownerId = 'core') {
    const zone = this._normalizePosition(position)
    if (!zone) {
      console.warn('StatusBarService: invalid position', position)
      return null
    }

    const normalizedItem = this._normalizeItem(itemConfig, ownerId)
    const currentItems = this.sections[zone] ?? []
    const filteredItems = currentItems.filter(item => item.id !== normalizedItem.id)
    const nextItems = this._sortItems([...filteredItems, normalizedItem])

    this.sections = {
      ...this.sections,
      [zone]: nextItems
    }

    return normalizedItem
  }

  unregisterItem(position, itemId, ownerId = null) {
    const zone = this._normalizePosition(position)
    if (!zone) {
      return
    }
    const normalizedId = this._normalizeId(itemId)
    const currentItems = this.sections[zone] ?? []
    const nextItems = currentItems.filter(item => {
      if (item.id !== normalizedId) {
        return true
      }
      if (ownerId && item.ownerId && item.ownerId !== ownerId) {
        return true
      }
      return false
    })

    if (nextItems.length === currentItems.length) {
      return
    }

    this.sections = {
      ...this.sections,
      [zone]: nextItems
    }
  }

  unregisterOwner(ownerId) {
    if (!ownerId) {
      return
    }

    const nextSections = {}
    let changed = false

    for (const key of Object.keys(this.sections)) {
      const currentItems = this.sections[key] ?? []
      const filtered = currentItems.filter(item => item.ownerId !== ownerId)
      nextSections[key] = filtered
      if (filtered.length !== currentItems.length) {
        changed = true
      }
    }

    if (changed) {
      this.sections = {
        left: nextSections.left ?? [],
        center: nextSections.center ?? [],
        right: nextSections.right ?? []
      }
    }
  }

  clear(position = null) {
    if (!position) {
      this.sections = {
        left: [],
        center: [],
        right: []
      }
      return
    }

    const zone = this._normalizePosition(position)
    if (!zone) {
      return
    }

    this.sections = {
      ...this.sections,
      [zone]: []
    }
  }

  _normalizeItem(config = {}, ownerId) {
    const idSource = typeof config.id === 'string' && config.id.trim()
      ? config.id
      : (typeof config.text === 'string' && config.text.trim() ? config.text : crypto.randomUUID())
    const normalizedId = this._normalizeId(idSource)
    const order = Number.isFinite(config.order) ? config.order : 0

    return {
      id: normalizedId,
      order,
      ownerId,
      text: typeof config.text === 'function' ? config.text : (typeof config.text === 'string' ? config.text : null),
      component: config.component ?? null,
      props: config.props ?? {},
      className: typeof config.className === 'string' ? config.className : '',
      ariaLabel: typeof config.ariaLabel === 'string' ? config.ariaLabel : null
    }
  }

  _normalizePosition(position) {
    const normalized = typeof position === 'string' ? position.trim().toLowerCase() : ''
    if (normalized === 'left' || normalized === 'center' || normalized === 'right') {
      return normalized
    }
    return null
  }

  _sortItems(items = []) {
    return [...items].sort((a, b) => {
      if (a.order !== b.order) {
        return a.order - b.order
      }
      return a.id.localeCompare(b.id, 'fr', { sensitivity: 'base' })
    })
  }

  _normalizeId(source) {
    if (!source) {
      return crypto.randomUUID()
    }
    return `${source}`.trim().toLowerCase().normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || crypto.randomUUID()
  }
}

export const statusBarService = new StatusBarService()
