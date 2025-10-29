import { SCROLL_MODES } from '@/core/ScrollModes.svelte.js'

export class LayoutService {
  constructor() {
    // Layout simple : un seul tabgroup au début
    this.layout = $state({
      type: 'tabgroup',
      id: 'main',
      tabs: [],
      activeTab: null
    })

    // Focus global : seul un tab peut avoir le focus à la fois dans toute l'IDE
    this.globalFocusedTab = $state(null)

    // Store séparé pour les statuts modified des fichiers (par fileName, pas tabId)
    this.fileModifiedStates = $state({})

    this._saveTimeout = null
  }

  // ===== SECTION 1: SAUVEGARDE & PERSISTENCE =====

  _triggerAutoSave() {
    if (typeof window !== 'undefined') {
      clearTimeout(this._saveTimeout)
      this._saveTimeout = setTimeout(() => {
        this._autoSave()
      }, 500)
    }
  }

  _autoSave() {
    try {
      // Import dynamique d'ideStore pour éviter les dépendances circulaires
      import('@/stores/ideStore.svelte.js').then(({ ideStore }) => {
        if (ideStore.user) {
          ideStore.saveUserLayout()
        }
      })
    } catch (error) {
      console.warn('Auto-sauvegarde echouee:', error)
    }
  }

  _createSerializableLayout(layout) {
    if (!layout) {
      return null
    }
    
    const serializableLayout = {
      ...layout,
      tabs: layout.tabs ? layout.tabs.map(tab => {
        // Vérifier que le tab a la méthode getSerializableData
        if (tab && typeof tab.getSerializableData === 'function') {
          return tab.getSerializableData()
        }
        // Fallback pour les tabs qui n'ont pas la méthode
        return {
          id: tab.id,
          title: tab.title,
          closable: tab.closable,
          icon: tab.icon,
          descriptor: tab.descriptor || null,
          scrollMode: tab.scrollMode || SCROLL_MODES.ide
        }
      }) : [],
      activeTab: layout.activeTab ? layout.activeTab.id : null
    }
    
    // Ajouter le focus global au layout sérialisé
    serializableLayout.globalFocusedTab = this.globalFocusedTab
    
    return serializableLayout
  }

  // ===== SECTION 2: API SIMPLE - GESTION DES TABS =====

  get tabs() {
    return this._collectAllTabs(this.layout)
  }

  get activeTab() {
    // Retourner le tab avec le focus global
    if (this.globalFocusedTab) {
      return this.getTabById(this.globalFocusedTab)
    }
    return this._findActiveTab(this.layout)
  }

  addTab(tab) {
    const targetGroup = this._findActiveGroup(this.layout) || this._findFirstGroup(this.layout)
    if (targetGroup) {
      // Vérifier s'il y a déjà un onglet pour ce fichier dans le groupe
      const existing = targetGroup.tabs.find(t => 
        t.id === tab.id || (tab.fileName && t.fileName === tab.fileName)
      )
      if (!existing) {
        targetGroup.tabs.push(tab)
        targetGroup.activeTab = tab.id
        // Définir le focus global sur ce nouveau tab
        this.globalFocusedTab = tab.id
      } else {
        // Activer l'onglet existant au lieu d'en créer un nouveau
        targetGroup.activeTab = existing.id
        this.globalFocusedTab = existing.id
      }
      this._triggerAutoSave()
    }
  }

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

      // Gérer le focus global
      if (this.globalFocusedTab === tabId) {
        // Si on ferme le tab avec le focus global, donner le focus au nouveau activeTab du groupe
        if (group.activeTab) {
          this.globalFocusedTab = group.activeTab
        } else {
          // Sinon, essayer de trouver un autre tab actif dans un autre groupe
          const nextActiveTab = this._findActiveTab(this.layout)
          this.globalFocusedTab = nextActiveTab ? nextActiveTab.id : null
        }
      }

      // Nettoyer les groupes vides après la fermeture
      this._cleanupEmptyGroups()
      
      // Si plus aucun tab nulle part, reset le focus global aussi
      if (this.tabs.length === 0) {
        this.globalFocusedTab = null
        this.layout = {
          type: 'tabgroup',
          id: 'main',
          tabs: [],
          activeTab: null
        }
      }

      this._triggerAutoSave()
      return tabId
    }
    return null
  }

  clearAllTabs() {
    const collectAllGroups = (node) => {
      const groups = []
      if (node.type === 'tabgroup') {
        groups.push(node)
      } else if (node.type === 'container') {
        node.children.forEach(child => groups.push(...collectAllGroups(child)))
      }
      return groups
    }

    const allGroups = collectAllGroups(this.layout)
    allGroups.forEach(group => {
      group.tabs = []
      group.activeTab = null
    })

    this.globalFocusedTab = null
    this._triggerAutoSave()
  }

  setActiveTab(tabId) {
    const group = this._findGroupContainingTab(this.layout, tabId)
    if (group) {
      group.activeTab = tabId
      // Définir le focus global
      this.globalFocusedTab = tabId
      this._triggerAutoSave()
      return group.tabs.find(t => t.id === tabId)
    }
    return null
  }

  getTabById(tabId) {
    const allTabs = this._collectAllTabs(this.layout)
    return allTabs.find(tab => tab.id === tabId) || null
  }

  // ===== SECTION 3: GESTION DES FICHIERS MODIFIÉS =====

  setFileModified(fileName, modified) {
    if (modified) {
      this.fileModifiedStates[fileName] = true
    } else {
      delete this.fileModifiedStates[fileName]
    }
    this._triggerAutoSave()
    return true
  }

  isFileModified(fileName) {
    return !!this.fileModifiedStates[fileName]
  }

  setTabModified(tabId, modified) {
    const tab = this.getTabById(tabId)
    if (tab && tab.fileName) {
      return this.setFileModified(tab.fileName, modified)
    }
    return false
  }

  isTabModified(tabId) {
    const tab = this.getTabById(tabId)
    return tab?.fileName ? this.isFileModified(tab.fileName) : false
  }

  // ===== SECTION 4: DRAG & DROP - RÉORGANISATION =====

  moveTabBetweenGroups(draggedTabId, sourceGroupId, targetGroupId, targetIndex = -1) {
    const sourceGroup = this._findGroupById(this.layout, sourceGroupId)
    const targetGroup = this._findGroupById(this.layout, targetGroupId)
    
    if (!sourceGroup || !targetGroup) return false

    // Trouver et retirer le tab du groupe source
    const tabIndex = sourceGroup.tabs.findIndex(t => t.id === draggedTabId)
    if (tabIndex === -1) return false

    const [tab] = sourceGroup.tabs.splice(tabIndex, 1)

    // Vérifier s'il y a déjà un onglet pour ce fichier dans le groupe cible
    const existing = targetGroup.tabs.find(t => 
      t.id === tab.id || (tab.fileName && t.fileName === tab.fileName)
    )
    
    if (existing) {
      // Activer l'onglet existant au lieu de créer un doublon
      targetGroup.activeTab = existing.id
      this.globalFocusedTab = existing.id
      // Remettre le tab dans le groupe source puisqu'on ne le déplace pas
      sourceGroup.tabs.splice(tabIndex, 0, tab)
      return true
    }

    // Gérer l'activeTab du groupe source
    if (sourceGroup.activeTab === draggedTabId) {
      sourceGroup.activeTab = sourceGroup.tabs.length > 0 
        ? sourceGroup.tabs[Math.min(tabIndex, sourceGroup.tabs.length - 1)].id
        : null
    }

    // Ajouter le tab au groupe cible
    if (targetIndex === -1) {
      targetGroup.tabs.push(tab)
    } else {
      targetGroup.tabs.splice(targetIndex, 0, tab)
    }

    // Activer le tab déplacé dans le groupe cible
    targetGroup.activeTab = tab.id
    this.globalFocusedTab = tab.id

    // Nettoyer les groupes vides
    this._cleanupEmptyGroups()
    this._triggerAutoSave()
    return true
  }

  reorderTabsInGroup(groupId, newTabsOrder) {
    const group = this._findGroupById(this.layout, groupId)
    if (group && group.type === 'tabgroup') {
      group.tabs = newTabsOrder
      this._triggerAutoSave()
    }
  }

  // ===== SECTION 5: DRAG & DROP - CRÉATION DE SPLITS =====

  createSplitFromDropZone(targetGroupId, zone, draggedTabId, sourceGroupId) {
    const targetGroup = this._findGroupById(this.layout, targetGroupId)
    const sourceGroup = this._findGroupById(this.layout, sourceGroupId)
    
    if (!targetGroup || !sourceGroup) return false
    
    // Si c'est la zone centre ou tabbar, faire un drop normal avec vérification de doublons
    if (zone === 'center' || zone === 'tabbar') {
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

    // Définir le focus global sur le tab déplacé
    this.globalFocusedTab = tab.id

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

  // ===== SECTION 6: SPLITS MANUELS =====

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

    // Définir le focus global sur le tab déplacé
    this.globalFocusedTab = activeTab.id

    // Remplacer le groupe dans l'arbre
    this._replaceNode(this.layout, groupId, newContainer)
    this._triggerAutoSave()
    return newContainer
  }

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

    // CrÃƒÂ©er le nouveau container
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

    // Définir le focus global sur le tab déplacé
    this.globalFocusedTab = activeTab.id

    // Remplacer le groupe dans l'arbre
    this._replaceNode(this.layout, groupId, newContainer)
    this._triggerAutoSave()
    return newContainer
  }

  // ===== SECTION 7: REDIMENSIONNEMENT =====

  updateSizes(containerId, newSizes) {
    const container = this._findGroupById(this.layout, containerId)
    if (container && container.type === 'container') {
      container.sizes = newSizes
      this._triggerAutoSave()
    }
  }

  // ===== SECTION 8: NETTOYAGE =====

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

  // ===== SECTION 9: UTILITAIRES DE NAVIGATION =====

  _collectAllTabs(node) {
    if (node.type === 'tabgroup') {
      return node.tabs
    } else if (node.type === 'container') {
      return node.children.flatMap(child => this._collectAllTabs(child))
    }
    return []
  }

  _findActiveTab(node) {
    if (node.type === 'tabgroup' && node.activeTab) {
      return node.tabs.find(tab => tab.id === node.activeTab) || null
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
    } else if (node.type === 'container' && node.children.length > 0) {
      return this._findFirstGroup(node.children[0])
    }
    return null
  }

  _findGroupById(node, id) {
    if (node.id === id) {
      return node
    } else if (node.type === 'container') {
      for (const child of node.children) {
        const found = this._findGroupById(child, id)
        if (found) return found
      }
    }
    return null
  }

  _findGroupContainingTab(node, tabId) {
    if (node.type === 'tabgroup') {
      const hasTab = node.tabs.some(tab => tab.id === tabId)
      return hasTab ? node : null
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
      Object.assign(root, newNode)
      return true
    }

    if (root.type === 'container') {
      for (let i = 0; i < root.children.length; i++) {
        if (root.children[i].id === targetId) {
          root.children[i] = newNode
          return true
        } else {
          if (this._replaceNode(root.children[i], targetId, newNode)) {
            return true
          }
        }
      }
    }
    return false
  }

  // ===== SECTION 10: GESTION DU FOCUS GLOBAL =====

  setGlobalFocus(tabId) {
    // Vérifier que le tab existe
    const tab = this.getTabById(tabId)
    if (tab) {
      this.globalFocusedTab = tabId
      // S'assurer que le tab est aussi actif dans son groupe
      const group = this._findGroupContainingTab(this.layout, tabId)
      if (group) {
        group.activeTab = tabId
      }
      this._triggerAutoSave()
      return true
    }
    return false
  }

  restoreGlobalFocus(tabId) {
    // Méthode pour restaurer le focus sans trigger de sauvegarde (utilisée lors de la restauration)
    const tab = this.getTabById(tabId)
    if (tab) {
      this.globalFocusedTab = tabId
      const group = this._findGroupContainingTab(this.layout, tabId)
      if (group) {
        group.activeTab = tabId
      }
      return true
    }
    return false
  }

  clearGlobalFocus() {
    this.globalFocusedTab = null
    this._triggerAutoSave()
  }

  // Méthodes pour le StateProviderService
  saveState() {
    return {
      globalFocusedTab: this.globalFocusedTab,
      fileModifiedStates: { ...this.fileModifiedStates }
    }
  }

  restoreState(state) {
    if (!state) return

    if (state.globalFocusedTab !== undefined) {
      // Ne pas utiliser restoreGlobalFocus ici car les tabs ne sont peut-être pas encore créés
      this.globalFocusedTab = state.globalFocusedTab
    }

    if (state.fileModifiedStates) {
      this.fileModifiedStates = { ...state.fileModifiedStates }
    }
  }
}

// Instance par défaut (comme contextMenuService)
export const layoutService = new LayoutService()
