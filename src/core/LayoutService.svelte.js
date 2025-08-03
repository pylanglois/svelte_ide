export class LayoutService {
  constructor() {
    // Layout simple : un seul tabgroup au début
    this.layout = $state({
      type: 'tabgroup',
      id: 'main',
      tabs: [],
      activeTab: null
    })

    // Store séparé pour les statuts modified des fichiers (par fileName, pas tabId)
    this.fileModifiedStates = $state({})

    this._saveTimeout = null
  }

  // Méthode à appeler manuellement pour déclencher la sauvegarde
  _triggerAutoSave() {
    if (typeof window !== 'undefined') {
      clearTimeout(this._saveTimeout)
      this._saveTimeout = setTimeout(() => {
        this._autoSave()
      }, 500)
    }
  }

  // Sauvegarde automatique
  _autoSave() {
    try {
      const layoutData = {
        layout: this.layout,
        timestamp: Date.now()
      }
      localStorage.setItem('ide-layout', JSON.stringify(layoutData))
    } catch (error) {
      console.warn('Auto-sauvegarde échouée:', error)
    }
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
      this._triggerAutoSave()
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

      // Nettoyer les groupes vides après la fermeture
      this._cleanupEmptyGroups()
      
      // Si plus aucun tab nulle part, reset au layout initial
      if (this.tabs.length === 0) {
        this.layout = {
          type: 'tabgroup',
          id: 'main',
          tabs: [],
          activeTab: null
        }
      }
      
      this._triggerAutoSave()
    }
    return tabId
  }

  // Activer un tab
  setActiveTab(tabId) {
    const group = this._findGroupContainingTab(this.layout, tabId)
    if (group) {
      group.activeTab = tabId
      this._triggerAutoSave()
      return group.tabs.find(t => t.id === tabId)
    }
    return null
  }

  // Obtenir un tab par son ID
  getTabById(tabId) {
    const group = this._findGroupContainingTab(this.layout, tabId)
    if (group) {
      return group.tabs.find(t => t.id === tabId)
    }
    return null
  }

  // Marquer un fichier comme modifié (affecte tous les tabs du même fichier)
  setFileModified(fileName, modified) {
    this.fileModifiedStates[fileName] = modified
    this._triggerAutoSave()
    return true
  }

  // Vérifier si un fichier est modifié
  isFileModified(fileName) {
    return this.fileModifiedStates[fileName] || false
  }

  // Méthode de compatibilité : marquer un tab comme modifié basé sur son fileName
  setTabModified(tabId, modified) {
    const tab = this.getTabById(tabId)
    if (tab && tab.fileName) {
      tab.setModified(modified)
      this.setFileModified(tab.fileName, modified)
      return true
    }
    return false
  }

  // Vérifier si un tab est modifié (basé sur son fileName)
  isTabModified(tabId) {
    const tab = this.getTabById(tabId)
    if (tab && tab.fileName) {
      return this.isFileModified(tab.fileName)
    }
    return false
  }

  // Réorganiser les tabs dans un groupe
  reorderTabs(newTabsOrder) {
    const group = this._findActiveGroup(this.layout) || this._findFirstGroup(this.layout)
    if (group) {
      group.tabs = newTabsOrder
      this._triggerAutoSave()
    }
  }

  // DRAG & DROP : Déplacer un tab entre groupes
  moveTabBetweenGroups(tabId, sourceGroupId, targetGroupId, targetPosition = -1) {
    const sourceGroup = this._findGroupById(this.layout, sourceGroupId)
    const targetGroup = this._findGroupById(this.layout, targetGroupId)
    
    if (!sourceGroup || !targetGroup) return false

    // Trouver et retirer le tab du groupe source
    const tabIndex = sourceGroup.tabs.findIndex(t => t.id === tabId)
    if (tabIndex === -1) return false

    const [tab] = sourceGroup.tabs.splice(tabIndex, 1)

    // Gérer l'activeTab du groupe source
    if (sourceGroup.activeTab === tabId) {
      sourceGroup.activeTab = sourceGroup.tabs.length > 0 
        ? sourceGroup.tabs[Math.min(tabIndex, sourceGroup.tabs.length - 1)].id
        : null
    }

    // Ajouter le tab au groupe cible
    if (targetPosition === -1 || targetPosition >= targetGroup.tabs.length) {
      targetGroup.tabs.push(tab)
    } else {
      targetGroup.tabs.splice(targetPosition, 0, tab)
    }

    // Activer le tab déplacé dans le groupe cible
    targetGroup.activeTab = tab.id

    // Nettoyer les groupes vides
    this._cleanupEmptyGroups()
    this._triggerAutoSave()

    return true
  }

  // Réorganiser les tabs dans un groupe spécifique (pour drag & drop interne)
  reorderTabsInGroup(groupId, newTabsOrder) {
    const group = this._findGroupById(this.layout, groupId)
    if (group && group.type === 'tabgroup') {
      group.tabs = newTabsOrder
      this._triggerAutoSave()
    }
  }

  // DRAG & DROP : Créer un nouveau split en déposant sur les zones (style IntelliJ)
  createSplitFromDropZone(targetGroupId, zone, draggedTabId, sourceGroupId) {
    const targetGroup = this._findGroupById(this.layout, targetGroupId)
    const sourceGroup = this._findGroupById(this.layout, sourceGroupId)
    
    if (!targetGroup || !sourceGroup) return false
    
    // Si c'est la zone centre, faire un drop normal
    if (zone === 'center') {
      return this.moveTabBetweenGroups(draggedTabId, sourceGroupId, targetGroupId, -1)
    }

    // Trouver et retirer le tab du groupe source
    const tabIndex = sourceGroup.tabs.findIndex(t => t.id === draggedTabId)
    if (tabIndex === -1) return false

    const [tab] = sourceGroup.tabs.splice(tabIndex, 1)

    // Gérer l'activeTab du groupe source
    if (sourceGroup.activeTab === draggedTabId) {
      sourceGroup.activeTab = sourceGroup.tabs.length > 0 
        ? sourceGroup.tabs[Math.min(tabIndex, sourceGroup.tabs.length - 1)].id
        : null
    }

    // Créer le nouveau groupe pour le tab déplacé
    const newGroup = {
      type: 'tabgroup',
      id: crypto.randomUUID(),
      tabs: [tab],
      activeTab: tab.id
    }

    // Déterminer la direction et l'ordre des enfants selon la zone
    let direction, newFirst
    switch (zone) {
      case 'top':
        direction = 'vertical'
        newFirst = true
        break
      case 'bottom':
        direction = 'vertical'
        newFirst = false
        break
      case 'left':
        direction = 'horizontal'
        newFirst = true
        break
      case 'right':
        direction = 'horizontal'
        newFirst = false
        break
      default:
        return false
    }

    // Créer le nouveau container
    const newContainer = {
      type: 'container',
      direction: direction,
      id: crypto.randomUUID(),
      children: newFirst ? [newGroup, { ...targetGroup }] : [{ ...targetGroup }, newGroup],
      sizes: [50, 50]
    }

    // Remplacer le groupe cible par le nouveau container
    this._replaceNode(this.layout, targetGroupId, newContainer)

    // Nettoyer les groupes vides
    this._cleanupEmptyGroups()
    this._triggerAutoSave()

    return true
  }

  // Nettoyer les groupes vides et simplifier l'arbre
  _cleanupEmptyGroups() {
    this._cleanupNode(this.layout)
    
    // Si le root est un container vide, le reset
    if (this.layout.type === 'container' && this.layout.children.length === 0) {
      this.layout = {
        type: 'tabgroup',
        id: 'main',
        tabs: [],
        activeTab: null
      }
    }
  }

  _cleanupNode(node) {
    if (node.type === 'container') {
      // Nettoyer récursivement les enfants
      node.children = node.children.filter(child => {
        this._cleanupNode(child)
        // Garder les containers non vides et les tabgroups avec des tabs
        return (child.type === 'container' && child.children.length > 0) || 
               (child.type === 'tabgroup' && child.tabs.length > 0)
      })

      // Si le container n'a qu'un seul enfant, on peut le simplifier
      if (node.children.length === 1) {
        const child = node.children[0]
        // Remplacer ce container par son unique enfant
        Object.assign(node, child)
      }
      
      // Redistribuer les tailles si nécessaire
      if (node.children.length > 0 && node.children.length !== node.sizes.length) {
        const equalSize = 100 / node.children.length
        node.sizes = new Array(node.children.length).fill(equalSize)
      }
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
    this._triggerAutoSave()
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
    this._triggerAutoSave()
    return newContainer
  }

  // REDIMENSIONNEMENT : Mettre à jour les tailles d'un container
  updateSizes(containerId, newSizes) {
    const container = this._findGroupById(this.layout, containerId)
    if (container && container.type === 'container') {
      container.sizes = newSizes
      this._triggerAutoSave()
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
}

// Instance par défaut (comme contextMenuService)
export const layoutService = new LayoutService()
