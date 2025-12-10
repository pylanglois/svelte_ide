import { createLogger } from '@svelte-ide/lib/logger.js'

const logger = createLogger('core/main-menu-service')

class MainMenuService {
  constructor() {
    this.menus = $state([])
  }

  registerMenu(config = {}, ownerId = 'core') {
    const action = typeof config.action === 'function' ? config.action : null
    const type = config.type === 'action' || (!config.type && action) ? 'action' : 'menu'
    const label = typeof config.label === 'string' ? config.label.trim() : ''
    const ariaLabel = typeof config.ariaLabel === 'string' ? config.ariaLabel.trim() : ''
    const icon = typeof config.icon === 'string' ? config.icon.trim() : ''
    const iconComponent = this._extractComponent(config.iconComponent)
    const iconProps = this._extractProps(config.iconProps)
    const hasIcon = !!icon || !!iconComponent
    const normalizedId = this._normalizeId(config.id ?? label ?? icon)
    const order = Number.isFinite(config.order) ? config.order : 0
    const disabled = !!config.disabled

    if (type === 'menu' && !label) {
      logger.warn('MainMenuService: missing label for menu', config)
      return null
    }

    if (type === 'action') {
      if (!hasIcon && !label) {
        logger.warn('MainMenuService: missing icon for action menu', config)
        return null
      }
      if (!ariaLabel && !label) {
        logger.warn('MainMenuService: missing accessible label for action menu', config)
        return null
      }
    }

    const existing = this._findMenu(normalizedId)

    if (existing) {
      const updated = {
        ...existing,
        type,
        label,
        ariaLabel: ariaLabel || label,
        icon: type === 'action' ? icon : '',
        iconComponent: type === 'action' ? iconComponent : null,
        iconProps: type === 'action' ? iconProps : null,
        title: typeof config.title === 'string' ? config.title.trim() : existing.title || '',
        order,
        ownerId: existing.ownerId || ownerId,
        disabled,
        action: type === 'action' ? action : null
      }
      if (this._hasMenuChanged(existing, updated)) {
        this._replaceMenu(updated)
      }
      return updated
    }

    const menu = {
      id: normalizedId,
      type,
      label,
      ariaLabel: ariaLabel || label,
      icon: type === 'action' ? icon : '',
      iconComponent: type === 'action' ? iconComponent : null,
      iconProps: type === 'action' ? iconProps : null,
      title: typeof config.title === 'string' ? config.title.trim() : '',
      order,
      ownerId,
      disabled,
      action: type === 'action' ? action : null,
      items: []
    }

    this.menus = this._sortMenus([...this.menus, menu])
    return menu
  }

  unregisterMenu(menuId, ownerId = null) {
    const normalizedId = this._normalizeId(menuId)
    const existing = this._findMenu(normalizedId)
    if (!existing) {
      return
    }
    if (ownerId && existing.ownerId && existing.ownerId !== ownerId) {
      return
    }
    this.menus = this.menus.filter(menu => menu.id !== normalizedId)
  }

  registerMenuItem(menuId, itemConfig = {}, ownerId = 'core') {
    const menu = this._findMenu(menuId)
    if (!menu) {
      logger.warn(`MainMenuService: menu "${menuId}" not found for item`, itemConfig)
      return null
    }

    if (menu.type === 'action') {
      logger.warn(`MainMenuService: cannot register menu item on action menu "${menuId}"`, itemConfig)
      return null
    }

    const label = typeof itemConfig.label === 'string' ? itemConfig.label.trim() : ''
    const isSeparator = !!itemConfig.separator
    if (!label && !isSeparator) {
      logger.warn('MainMenuService: missing label for menu item', itemConfig)
      return null
    }

    let normalizedId
    if (typeof itemConfig.id === 'string' && itemConfig.id.trim()) {
      normalizedId = this._normalizeId(itemConfig.id)
    } else if (label) {
      normalizedId = this._normalizeId(label, `${menu.id}-item-`)
    } else {
      normalizedId = this._normalizeId(crypto.randomUUID(), `${menu.id}-item-`)
    }
    const order = Number.isFinite(itemConfig.order) ? itemConfig.order : 0
    const existingItems = menu.items.filter(item => item.id !== normalizedId)

    const nextItem = {
      id: normalizedId,
      label,
      order,
      shortcut: typeof itemConfig.shortcut === 'string' ? itemConfig.shortcut : '',
      disabled: !!itemConfig.disabled,
      action: typeof itemConfig.action === 'function' ? itemConfig.action : null,
      ownerId,
      separator: isSeparator
    }

    const nextItems = this._sortItems([...existingItems, nextItem])
    const updatedMenu = { ...menu, items: nextItems }
    this._replaceMenu(updatedMenu)
    return nextItem
  }

  unregisterMenuItem(menuId, itemId, ownerId = null) {
    const menu = this._findMenu(menuId)
    if (!menu) {
      return
    }
    const normalizedItemId = this._normalizeId(itemId)
    const nextItems = menu.items.filter(item => {
      if (item.id !== normalizedItemId) {
        return true
      }
      if (ownerId && item.ownerId && item.ownerId !== ownerId) {
        return true
      }
      return false
    })
    if (nextItems.length === menu.items.length) {
      return
    }
    const updatedMenu = { ...menu, items: nextItems }
    this._replaceMenu(updatedMenu)
  }

  unregisterOwner(ownerId) {
    if (!ownerId) {
      return
    }
    const nextMenus = []
    for (const menu of this.menus) {
      if (menu.ownerId && menu.ownerId === ownerId) {
        continue
      }
      const remainingItems = menu.items.filter(item => item.ownerId !== ownerId)
      if (remainingItems.length !== menu.items.length) {
        nextMenus.push({ ...menu, items: remainingItems })
        continue
      }
      nextMenus.push(menu)
    }
    if (nextMenus.length !== this.menus.length) {
      this.menus = this._sortMenus(nextMenus)
    } else {
      this.menus = nextMenus
    }
  }

  getMenu(menuId) {
    return this._findMenu(menuId)
  }

  _findMenu(menuId) {
    const normalizedId = this._normalizeId(menuId)
    return this.menus.find(menu => menu.id === normalizedId) || null
  }

  _replaceMenu(updatedMenu) {
    const nextMenus = this.menus.map(menu => (menu.id === updatedMenu.id ? updatedMenu : menu))
    this.menus = this._sortMenus(nextMenus)
  }

  _hasMenuChanged(previous, next) {
    return (
      previous.label !== next.label ||
      previous.order !== next.order ||
      previous.ownerId !== next.ownerId ||
      previous.type !== next.type ||
      previous.icon !== next.icon ||
      previous.iconComponent !== next.iconComponent ||
      previous.iconProps !== next.iconProps ||
      previous.ariaLabel !== next.ariaLabel ||
      previous.disabled !== next.disabled ||
      previous.title !== next.title ||
      previous.action !== next.action
    )
  }

  _sortMenus(menus = []) {
    return [...menus].sort((a, b) => {
      if (a.order !== b.order) {
        return a.order - b.order
      }
      const labelA = a.label || a.ariaLabel || a.id
      const labelB = b.label || b.ariaLabel || b.id
      return labelA.localeCompare(labelB, 'fr', { sensitivity: 'base' })
    })
  }

  _sortItems(items = []) {
    return [...items].sort((a, b) => {
      if (a.order !== b.order) {
        return a.order - b.order
      }
      return a.label.localeCompare(b.label, 'fr', { sensitivity: 'base' })
    })
  }

  _normalizeId(source, prefix = '') {
    if (!source && !prefix) {
      return crypto.randomUUID()
    }
    const raw = source ? `${source}`.trim().toLowerCase() : ''
    const base = raw
      ? raw.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
      : ''
    const finalId = base || crypto.randomUUID()
    return prefix ? `${prefix}${finalId}` : finalId
  }

  _extractComponent(component) {
    return typeof component === 'function' ? component : null
  }

  _extractProps(props) {
    if (!props || typeof props !== 'object') {
      return null
    }
    if (Array.isArray(props)) {
      return null
    }
    return props
  }
}

export const mainMenuService = new MainMenuService()
