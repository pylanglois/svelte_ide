export class LayoutService {
  constructor() {
    // Layout simple : un seul tabgroup au début
    this.layout = $state({
      type: 'tabgroup',
      id: 'main',
      tabs: [],
      activeTab: null
    })
  }

  // API SIMPLE pour gérer l'arbre de layout
  get tabs() {
    return this._collectAllTabs(this.layout)
  }

  get activeTab() {
    return this._findActiveTab(this.layout)
  }

  // Ajouter un tab dans le groupe actif ou le premier disponible
  addTab(tab) {
    const targetGroup = this._findActiveGroup(this.layout) || this._findFirstGroup(this.layout)
    if (targetGroup) {
      const existing = targetGroup.tabs.find(t => t.id === tab.id)
      if (!existing) {
        targetGroup.tabs.push(tab)
      }
      targetGroup.activeTab = tab.id
    }
  }

  // Fermer un tab et nettoyer si le groupe devient vide
  closeTab(tabId) {
    const group = this._findGroupContainingTab(this.layout, tabId)
    if (!group) return null

    const index = group.tabs.findIndex(t => t.id === tabId)
    if (index !== -1) {
      group.tabs.splice(index, 1)
      
      // Gérer l'activeTab
      if (group.activeTab === tabId) {
        group.activeTab = group.tabs.length > 0 
          ? group.tabs[group.tabs.length - 1].id 
          : null
      }
      
      // Nettoyer les groupes vides (si ce n'est pas le root)
      this._cleanupEmptyGroups()
    }
    return tabId
  }

  // Activer un tab
  setActiveTab(tabId) {
    const group = this._findGroupContainingTab(this.layout, tabId)
    if (group) {
      group.activeTab = tabId
      return group.tabs.find(t => t.id === tabId)
    }
    return null
  }

  // Réorganiser les tabs dans un groupe
  reorderTabs(newTabsOrder) {
    const group = this._findActiveGroup(this.layout) || this._findFirstGroup(this.layout)
    if (group) {
      group.tabs = newTabsOrder
    }
  }

  // SPLITS : Diviser un groupe horizontalement (côte à côte)
  splitHorizontal(groupId) {
    const group = this._findGroupById(this.layout, groupId)
    if (!group || group.type !== 'tabgroup') return null

    // Diviser seulement si il y a au moins un tab
    if (group.tabs.length === 0) return null

    // Prendre le tab actif pour le nouveau groupe
    const activeTab = group.tabs.find(t => t.id === group.activeTab)
    if (!activeTab) return null

    // Retirer le tab du groupe original
    group.tabs = group.tabs.filter(t => t.id !== activeTab.id)
    group.activeTab = group.tabs.length > 0 ? group.tabs[0].id : null

    // Créer le nouveau container
    const newContainer = {
      type: 'container',
      direction: 'horizontal',
      id: crypto.randomUUID(),
      children: [
        { ...group }, // Groupe original
        {
          type: 'tabgroup',
          id: crypto.randomUUID(),
          tabs: [activeTab],
          activeTab: activeTab.id
        }
      ],
      sizes: [50, 50] // Tailles égales par défaut
    }

    // Remplacer le groupe dans l'arbre
    this._replaceNode(this.layout, groupId, newContainer)
    return newContainer
  }

  // SPLITS : Diviser un groupe verticalement (haut/bas)
  splitVertical(groupId) {
    const group = this._findGroupById(this.layout, groupId)
    if (!group || group.type !== 'tabgroup') return null

    // Diviser seulement si il y a au moins un tab
    if (group.tabs.length === 0) return null

    // Prendre le tab actif pour le nouveau groupe
    const activeTab = group.tabs.find(t => t.id === group.activeTab)
    if (!activeTab) return null

    // Retirer le tab du groupe original
    group.tabs = group.tabs.filter(t => t.id !== activeTab.id)
    group.activeTab = group.tabs.length > 0 ? group.tabs[0].id : null

    // Créer le nouveau container
    const newContainer = {
      type: 'container',
      direction: 'vertical',
      id: crypto.randomUUID(),
      children: [
        { ...group }, // Groupe original
        {
          type: 'tabgroup',
          id: crypto.randomUUID(),
          tabs: [activeTab],
          activeTab: activeTab.id
        }
      ],
      sizes: [50, 50] // Tailles égales par défaut
    }

    // Remplacer le groupe dans l'arbre
    this._replaceNode(this.layout, groupId, newContainer)
    return newContainer
  }

  // REDIMENSIONNEMENT : Mettre à jour les tailles d'un container
  updateSizes(containerId, newSizes) {
    const container = this._findGroupById(this.layout, containerId)
    if (container && container.type === 'container') {
      container.sizes = newSizes
    }
  }

  // UTILITAIRES PRIVÉS : Navigation dans l'arbre
  _collectAllTabs(node) {
    if (node.type === 'tabgroup') {
      return node.tabs
    } else if (node.type === 'container') {
      return node.children.flatMap(child => this._collectAllTabs(child))
    }
    return []
  }

  _findActiveTab(node) {
    if (node.type === 'tabgroup') {
      return node.activeTab
    } else if (node.type === 'container') {
      for (const child of node.children) {
        const activeTab = this._findActiveTab(child)
        if (activeTab) return activeTab
      }
    }
    return null
  }

  _findActiveGroup(node) {
    if (node.type === 'tabgroup' && node.activeTab) {
      return node
    } else if (node.type === 'container') {
      for (const child of node.children) {
        const activeGroup = this._findActiveGroup(child)
        if (activeGroup) return activeGroup
      }
    }
    return null
  }

  _findFirstGroup(node) {
    if (node.type === 'tabgroup') {
      return node
    } else if (node.type === 'container') {
      return this._findFirstGroup(node.children[0])
    }
    return null
  }

  _findGroupById(node, id) {
    if (node.id === id) return node
    if (node.type === 'container') {
      for (const child of node.children) {
        const found = this._findGroupById(child, id)
        if (found) return found
      }
    }
    return null
  }

  _findGroupContainingTab(node, tabId) {
    if (node.type === 'tabgroup') {
      return node.tabs.some(t => t.id === tabId) ? node : null
    } else if (node.type === 'container') {
      for (const child of node.children) {
        const found = this._findGroupContainingTab(child, tabId)
        if (found) return found
      }
    }
    return null
  }

  _replaceNode(root, targetId, newNode) {
    if (root.id === targetId) {
      // Remplacer le root
      this.layout = newNode
      return true
    }
    
    if (root.type === 'container') {
      for (let i = 0; i < root.children.length; i++) {
        if (root.children[i].id === targetId) {
          root.children[i] = newNode
          return true
        }
        if (this._replaceNode(root.children[i], targetId, newNode)) {
          return true
        }
      }
    }
    return false
  }

  _cleanupEmptyGroups() {
    // Pour simplifier, on ne nettoie pas automatiquement
    // L'utilisateur peut fermer manuellement les splits vides
  }
}

// Instance par défaut (comme contextMenuService)
export const layoutService = new LayoutService()
