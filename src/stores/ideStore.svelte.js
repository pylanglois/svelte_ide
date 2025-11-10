import { eventBus } from '@/core/EventBusService.svelte.js'
import { layoutService } from '@/core/LayoutService.svelte.js'
import { mainMenuService } from '@/core/MainMenuService.svelte.js'
import { MODAL_CANCELLED_BY_X, modalService } from '@/core/ModalService.svelte.js'
import { panelsManager } from '@/core/PanelsManager.svelte.js'
import { persistenceRegistry } from '@/core/persistence/PersistenceRegistry.svelte.js'
import { preferencesService } from '@/core/PreferencesService.svelte.js'
import { SCROLL_MODES } from '@/core/ScrollModes.svelte.js'
import { stateProviderService } from '@/core/StateProviderService.svelte.js'
import { Tab } from '@/core/Tab.svelte.js'
import { toolFocusCoordinator } from '@/core/ToolFocusCoordinator.svelte.js'
import { getAuthStore } from './authStore.svelte.js'

const LAYOUT_SCHEMA_VERSION = 2

const buildUserStorageKey = (user) => {
  if (!user) return null
  const provider = user.provider || 'default'
  const identifier = user.email || user.id || user.name
  if (!identifier) return null
  return `${provider}-${identifier}`
}

class IdeStore {
  constructor() {
    this.tools = $state([])
    
    this.statusMessage = $state('')

    this.draggedTool = $state(null)
    this.draggedToolSource = $state(null)
    this.dragOverZone = $state(null)

    this.consoleTabs = $state([])
    this.activeConsoleTab = $state(null)
    this._logIdCounter = 0

    this.notifications = $state([])
    this.unreadNotificationsCount = $state(0)
    this._notificationIdCounter = 0

    this.topLeftTools = $state([])
    this.bottomLeftTools = $state([])
    this.topRightTools = $state([])
    this.bottomRightTools = $state([])
    this.bottomTools = $state([])
    this.currentFocusGroup = $state(null)
    
    this._updateToolLists()
    
    this.panelsManager = panelsManager
    try {
      this.layoutPersister = persistenceRegistry.createPersister('user-layout', 'json', {
        storeName: 'user-layout'
      })
    } catch (error) {
      console.warn('IdeStore: IndexedDB persister unavailable, falling back to default storage', error)
      this.layoutPersister = persistenceRegistry.getPersister('user-layout')
    }
    this._lastRestoredUserKey = null
    this._restorationAttemptedUsers = new Set()
    
    // Sauvegarder automatiquement quand l'état change
    stateProviderService.registerProvider('layout', this)
    stateProviderService.registerProvider('layoutService', layoutService)
    this.panelsManager.addChangeCallback(() => {
      this._updateToolLists()
      this.saveUserLayout()
    })

    eventBus.subscribe('tools:focus-group-changed', ({ groupId }) => {
      this._setCurrentFocusGroup(groupId)
    })
  }

  get tabs() {
    return layoutService.tabs
  }

  get activeTab() {
    return layoutService.activeTab
  }

  get preferences() {
    return preferencesService
  }

  get user() {
    const authStore = getAuthStore()
    return authStore.currentUser
  }

  get isAuthenticated() {
    const authStore = getAuthStore()
    return authStore.isAuthenticated
  }

  _updateToolLists() {
    const buckets = {
      topLeft: [],
      bottomLeft: [],
      topRight: [],
      bottomRight: [],
      bottom: []
    }

    for (const tool of this.tools) {
      if (!tool) continue
      const position = tool.position
      if (!position || !buckets[position]) {
        continue
      }
      buckets[position].push(tool)
    }

    this.topLeftTools = this._filterVisibleTools(buckets.topLeft)
    this.bottomLeftTools = this._filterVisibleTools(buckets.bottomLeft)
    this.topRightTools = this._filterVisibleTools(buckets.topRight)
    this.bottomRightTools = this._filterVisibleTools(buckets.bottomRight)
    this.bottomTools = this._filterVisibleTools(buckets.bottom)
  }

  _filterVisibleTools(tools = []) {
    if (!Array.isArray(tools) || tools.length === 0) {
      return []
    }

    const focusGroup = this.currentFocusGroup
    return tools.filter(tool => {
      if (!tool) {
        return false
      }

      if (tool.visibilityMode !== 'contextual') {
        return true
      }

      if (this._isToolPanelActive(tool)) {
        return true
      }

      const toolGroup = this._getToolFocusGroup(tool)
      return focusGroup && toolGroup && toolGroup === focusGroup
    })
  }

  _isToolPanelActive(tool) {
    if (!tool || !tool.panelId) {
      return false
    }
    const manager = this.panelsManager
    if (!manager || typeof manager.getPanel !== 'function') {
      return false
    }
    const panel = manager.getPanel(tool.panelId)
    return !!(panel && panel.isActive)
  }

  _getToolFocusGroup(tool) {
    if (!tool) {
      return null
    }
    if (typeof tool.focusGroup === 'string') {
      const normalized = tool.focusGroup.trim()
      if (normalized) {
        return normalized
      }
    }
    const registeredGroup = toolFocusCoordinator.getGroupForTool(tool.id)
    if (registeredGroup) {
      return registeredGroup
    }
    return this._deriveGroupId(tool)
  }

  _deriveGroupId(tool) {
    const source = typeof tool?.id === 'string' ? tool.id : ''
    if (!source) {
      return null
    }
    const separatorIndex = source.indexOf('-')
    if (separatorIndex === -1) {
      return source
    }
    const prefix = source.slice(0, separatorIndex)
    return prefix || source
  }

  _setCurrentFocusGroup(groupId) {
    const normalized = typeof groupId === 'string' ? groupId.trim() : null
    if (this.currentFocusGroup === normalized) {
      return
    }
    this.currentFocusGroup = normalized
    this._updateToolLists()
  }

  addTool(tool) {
    if (!this.tools.find(t => t.id === tool.id)) {
      this.tools.push(tool)
      this._updateToolLists()
    }
  }

  removeTool(toolId) {
    const index = this.tools.findIndex(tool => tool.id === toolId)
    if (index !== -1) {
      this.tools.splice(index, 1)
      this._updateToolLists()
    }
  }

  registerMenu(config, ownerId = 'core') {
    return mainMenuService.registerMenu(config, ownerId)
  }

  unregisterMenu(menuId, ownerId = null) {
    mainMenuService.unregisterMenu(menuId, ownerId)
  }

  registerMenuItem(menuId, itemConfig, ownerId = 'core') {
    return mainMenuService.registerMenuItem(menuId, itemConfig, ownerId)
  }

  unregisterMenuItem(menuId, itemId, ownerId = null) {
    mainMenuService.unregisterMenuItem(menuId, itemId, ownerId)
  }

  unregisterMenuEntries(ownerId) {
    mainMenuService.unregisterOwner(ownerId)
  }

  moveTool(toolId, newPosition) {
    const tool = this.tools.find(t => t.id === toolId)
    if (!tool) return

    const manager = this.panelsManager
    if (manager && tool.panelId) {
      const moved = manager.movePanelToPosition(tool.panelId, newPosition)
      if (!moved) return
    }

    tool.setPosition(newPosition)
    this._updateToolLists()
  }

  getToolById(toolId) {
    return this.tools.find(tool => tool.id === toolId) || null
  }

  addConsoleTab(title) {
    let consoleTab = this.consoleTabs.find(tab => tab.title === title)
    if (!consoleTab) {
      consoleTab = {
        id: `console-${++this._logIdCounter}`,
        title,
        logs: []
      }
      this.consoleTabs.push(consoleTab)
    }
    this.activeConsoleTab = consoleTab.id
    return consoleTab
  }

  closeConsoleTab(tabId) {
    const index = this.consoleTabs.findIndex(tab => tab.id === tabId)
    if (index !== -1) {
      this.consoleTabs.splice(index, 1)
      if (this.activeConsoleTab === tabId) {
        this.activeConsoleTab = this.consoleTabs.length > 0 ? this.consoleTabs[0].id : null
      }
    }
  }

  clearConsoleTab(tabId) {
    const tab = this.consoleTabs.find(tab => tab.id === tabId)
    if (tab) {
      tab.logs.splice(0, tab.logs.length)
    }
  }

  setActiveConsoleTab(tabId) {
    this.activeConsoleTab = tabId
  }
  
  addLog(message, type = 'info', tabTitle = 'Général') {
    const consoleTab = this.addConsoleTab(tabTitle)
    consoleTab.logs.push({
      id: ++this._logIdCounter,
      message,
      type,
      timestamp: new Date()
    })
    this.consoleTabs = [...this.consoleTabs]
  }

  addNotification(title, message, type = 'info', source = 'IDE') {
    const notification = {
      id: ++this._notificationIdCounter,
      title,
      message,
      type,
      source,
      timestamp: new Date(),
      read: false
    }
    this.notifications.unshift(notification)
    this.unreadNotificationsCount += 1
    return notification.id
  }

  markNotificationAsRead(notificationId) {
    const notification = this.notifications.find(n => n.id === notificationId)
    if (notification && !notification.read) {
      notification.read = true
      this.unreadNotificationsCount = Math.max(0, this.unreadNotificationsCount - 1)
    }
  }

  markAllNotificationsAsRead() {
    this.notifications.forEach(n => n.read = true)
    this.unreadNotificationsCount = 0
  }

  removeNotification(notificationId) {
    const index = this.notifications.findIndex(n => n.id === notificationId)
    if (index !== -1) {
      const notification = this.notifications[index]
      if (!notification.read) {
        this.unreadNotificationsCount = Math.max(0, this.unreadNotificationsCount - 1)
      }
      this.notifications.splice(index, 1)
    }
  }

  clearAllNotifications() {
    this.notifications = []
    this.unreadNotificationsCount = 0
  }

  addTab(tab) {
    layoutService.addTab(tab)
    eventBus.publish('tabs:added', { tab })
    eventBus.publish('tabs:activated', layoutService.activeTab)
    this.saveUserLayout()
  }

  _generateTabId() {
    return `tab-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

  _handleContentChange(tabId, newContent) {
    eventBus.publish('file:content-changed', { tabId, content: newContent })
  }

  _handleDirtyState(tabId, isDirty) {
    const tab = this.getTabById(tabId)
    if (tab && tab.fileName) {
      const currentState = layoutService.isFileModified(tab.fileName)
      if (currentState !== isDirty) {
        this.setFileModified(tab.fileName, isDirty)
      }
    }
  }

  openFile({ fileName, content, component, icon = '📄', toolId = null, scrollMode = SCROLL_MODES.ide }) {
    const tabId = this._generateTabId()
    
    const tab = new Tab(tabId, fileName, component, true, icon, scrollMode)
    tab.fileName = fileName
    tab.content = content
    tab.originalContent = content
    tab.toolId = toolId
    tab.onContentChange = (newContent) => this._handleContentChange(tabId, newContent)
    tab.onDirtyStateChange = (isDirty) => this._handleDirtyState(tabId, isDirty)
    
    tab.setDescriptor({
      type: 'file-editor',
      resourceId: fileName,
      toolId: toolId,
      icon: icon,
      params: {}
    })
    
    this.addTab(tab)
    return tab
  }

  async closeTab(tabId) {
    const tab = layoutService.getTabById(tabId)
    if (!tab) {
      return false
    }
    if (tab.closable === false) {
      return false
    }

    if (layoutService.isTabModified(tabId)) {
      const confirmResult = await modalService.confirm({
        icon: '💾',
        question: `Enregistrer les modifications de "${tab.title}" ?`,
        description: 'Cet onglet contient des changements non enregistres. Que souhaitez-vous faire ?',
        buttons: [
          { id: 'save', label: 'Enregistrer' },
          { id: 'discard', label: 'Jeter' },
          { id: 'cancel', label: 'Annuler' }
        ]
      })

      const actionId = typeof confirmResult === 'string'
        ? confirmResult
        : confirmResult?.actionId

      if (!actionId || actionId === MODAL_CANCELLED_BY_X || actionId === 'cancel') {
        return false
      }

      if (actionId === 'save') {
        if (typeof tab.onSave === 'function') {
          try {
            const saveResult = await tab.onSave()
            if (saveResult === false) {
              return false
            }
          } catch (error) {
            console.error(`ideStore.closeTab: erreur lors de la sauvegarde de l'onglet ${tab.id}`, error)
            return false
          }
        } else {
          console.warn(`ideStore.closeTab: aucun gestionnaire de sauvegarde pour l'onglet ${tab.id}`)
          return false
        }
        if (layoutService.isTabModified(tabId)) {
          layoutService.setTabModified(tabId, false)
        }
      } else if (actionId === 'discard') {
        if (typeof tab.onDiscard === 'function') {
          try {
            const discardResult = await tab.onDiscard()
            if (discardResult === false) {
              return false
            }
          } catch (error) {
            console.error(`ideStore.closeTab: erreur lors de l'abandon des changements de l'onglet ${tab.id}`, error)
            return false
          }
        } else if (tab.fileName) {
          layoutService.setTabModified(tabId, false)
        }
      } else {
        return false
      }
    }

    const closedTabId = layoutService.closeTab(tabId)
    if (closedTabId) {
      eventBus.publish('tabs:closed', { tabId: closedTabId })
      eventBus.publish('tabs:activated', layoutService.activeTab)
      this.saveUserLayout()
      return true
    }
    return false
  }

  reorderTabs(newTabsOrder) {
    layoutService.reorderTabs(newTabsOrder)
    this.saveUserLayout()
  }

  setActiveTab(tabId) {
    const tab = layoutService.setActiveTab(tabId)
    if (tab) {
      eventBus.publish('tabs:activated', tab)
      this.saveUserLayout()
    } else if (tabId === null) {
      eventBus.publish('tabs:activated', null)
    }
  }

  getTabById(tabId) {
    return layoutService.getTabById(tabId)
  }

  setTabModified(tabId, modified) {
    const success = layoutService.setTabModified(tabId, modified)
    if (success) {
      eventBus.publish('tabs:modified', { tabId, modified })
    }
    return success
  }

  setFileModified(fileName, modified) {
    const success = layoutService.setFileModified(fileName, modified)
    if (success) {
      eventBus.publish('file:modified', { fileName, modified })
    }
    return success
  }

  isTabModified(tabId) {
    return layoutService.isTabModified(tabId)
  }

  isFileModified(fileName) {
    return layoutService.isFileModified(fileName)
  }

  setStatusMessage(message) {
    this.statusMessage = message
  }

  async login(providerId) {
    const authStore = getAuthStore()
    return await authStore.login(providerId)
  }

  async logout() {
    const authStore = getAuthStore()
    return await authStore.logout()
  }

  getAccessToken() {
    const authStore = getAuthStore()
    return authStore.getAccessToken()
  }

  closeAllTabs() {
    layoutService.clearAllTabs()
  }

  async restoreUserLayout(user) {
    try {
      const userKey = buildUserStorageKey(user)
      if (!userKey) {
        console.warn('restoreUserLayout: utilisateur invalide, restauration ignorée')
        return
      }
      const storageKey = `user-${userKey}`
      const rawLayoutData = await this.layoutPersister.load(storageKey)
      this._restorationAttemptedUsers.add(userKey)
      
      if (!rawLayoutData) {
        return
      }

      const layoutData = this._migrateLayoutData(rawLayoutData)

      const pendingHydrations = []

      if (layoutData.layout) {
        this.closeAllTabs()
        
        const allTabsData = this._collectTabsFromLayout(layoutData.layout)
        
        const restoredTabs = new Map()
        
        for (const tabData of allTabsData) {
          if (tabData.descriptor) {
            
            const tab = new Tab(
              tabData.id,
              tabData.title,
              null,
              tabData.closable,
              tabData.icon,
              tabData.scrollMode || SCROLL_MODES.ide
            )
            tab.setDescriptor(tabData.descriptor)
            
            const hydrateCallback = (component, data = {}) => {
              tab.component = component
              if (tabData.descriptor.type === 'file-editor') {
                tab.fileName = tabData.descriptor.resourceId
                tab.content = data.content || ''
                tab.originalContent = data.content || ''
                tab.toolId = tabData.descriptor.toolId
                tab.onContentChange = (newContent) => this._handleContentChange(tabData.id, newContent)
                tab.onDirtyStateChange = (isDirty) => this._handleDirtyState(tabData.id, isDirty)
              }
            }
            
            restoredTabs.set(tabData.id, tab)
            
            pendingHydrations.push({
              descriptor: tabData.descriptor,
              tabId: tabData.id,
              hydrateCallback: hydrateCallback,
              userId: user.email
            })
          }
        }
        
        const restoredLayout = this._reconstructLayout(layoutData.layout, restoredTabs)
        
        // Si aucun onglet n'est actif mais qu'il y a des onglets, activer le premier
        if (!restoredLayout.activeTab && restoredLayout.tabs.length > 0) {
          restoredLayout.activeTab = restoredLayout.tabs[0].id
        }
        
        layoutService.layout = restoredLayout
        this._lastRestoredUserKey = userKey
        
        // Restaurer le focus global si disponible
        if (layoutData.layout.globalFocusedTab) {
          layoutService.restoreGlobalFocus(layoutData.layout.globalFocusedTab)
        }
      }
      
      // Restaurer tous les états via le service de fournisseurs
      const shouldEmitHydrationEvents = pendingHydrations.length > 0 || Boolean(layoutData.states)
      const hydrationContext = shouldEmitHydrationEvents
        ? {
            userId: user?.email || null,
            pendingTabs: pendingHydrations.length,
            timestamp: Date.now()
          }
        : null

      if (hydrationContext) {
        eventBus.publish('hydration:before', hydrationContext)
      }

      if (layoutData.states) {
        await stateProviderService.restoreAllStates(layoutData.states)
      }

      if (pendingHydrations.length > 0) {
        for (const hydrateEvent of pendingHydrations) {
          eventBus.publish('tab:hydrate', hydrateEvent)
        }
      }

      if (hydrationContext) {
        eventBus.publish('hydration:after', {
          ...hydrationContext,
          hydratedTabs: pendingHydrations.length,
          completedAt: Date.now()
        })
      }

      const activeTabAfterRestore = layoutService.activeTab
      eventBus.publish('tabs:activated', activeTabAfterRestore || null)

    } catch (error) {
      console.error('Error restoring user layout:', error)
    } finally {
      const userKey = buildUserStorageKey(user)
      if (userKey) {
        this._restorationAttemptedUsers.add(userKey)
      }
    }
  }

  _reconstructLayout(layoutData, tabsMap) {
    if (layoutData.type === 'tabgroup') {
      return {
        ...layoutData,
        tabs: layoutData.tabs.map(tabData => tabsMap.get(tabData.id)).filter(Boolean),
        activeTab: layoutData.activeTab
      }
    } else if (layoutData.type === 'container') {
      return {
        ...layoutData,
        children: layoutData.children.map(child => this._reconstructLayout(child, tabsMap))
      }
    }
    return layoutData
  }

  async saveUserLayout() {
    if (!this.isAuthenticated || !this.user) return
    
    try {
      const userKey = buildUserStorageKey(this.user)
      if (!userKey) {
        console.warn('saveUserLayout: utilisateur invalide, sauvegarde ignorée')
        return
      }
      const storageKey = `user-${userKey}`
      
      if (!this._restorationAttemptedUsers.has(userKey)) {
        const alreadyExists = await this.layoutPersister.exists(storageKey)
        if (alreadyExists) {
          return
        }
      }
      
      this._restorationAttemptedUsers.add(userKey)
      const serializableLayout = layoutService._createSerializableLayout(layoutService.layout)
      
      if (serializableLayout) {
        const states = await stateProviderService.saveAllStatesAsync()
        const layoutData = {
          layout: serializableLayout,
          states,
          timestamp: Date.now(),
          version: LAYOUT_SCHEMA_VERSION
        }
        
        await this.layoutPersister.save(storageKey, layoutData)
        this._lastRestoredUserKey = userKey
      }
    } catch (error) {
      console.error('Error saving user layout:', error)
    }
  }

  _collectTabsFromLayout(layout) {
    const tabs = []
    
    if (layout.type === 'tabgroup' && layout.tabs) {
      tabs.push(...layout.tabs)
    } else if (layout.type === 'container' && layout.children) {
      for (const child of layout.children) {
        tabs.push(...this._collectTabsFromLayout(child))
      }
    }
    
    return tabs
  }

  resetLayout() {
    layoutService.layout = {
      type: 'tabgroup',
      id: 'main',
      tabs: [],
      activeTab: null
    }
    this.saveUserLayout()
  }

  saveState() {
    return {}
  }

  restoreState(state) {
  }

  _migrateLayoutData(layoutEntry) {
    if (!layoutEntry) {
      return null
    }

    const versionNumber = typeof layoutEntry.version === 'number'
      ? layoutEntry.version
      : parseFloat(layoutEntry.version ?? '1')

    const normalizedStates = layoutEntry.states ?? {}
    const normalizedTimestamp = layoutEntry.timestamp ?? Date.now()

    if (Number.isNaN(versionNumber) || versionNumber >= LAYOUT_SCHEMA_VERSION) {
      return {
        ...layoutEntry,
        states: normalizedStates,
        timestamp: normalizedTimestamp,
        version: LAYOUT_SCHEMA_VERSION
      }
    }

    return {
      layout: layoutEntry.layout,
      states: normalizedStates,
      timestamp: normalizedTimestamp,
      version: LAYOUT_SCHEMA_VERSION
    }
  }

}

export function registerDefaultHelpMenu(ideStoreInstance, { menuId = 'help', ownerId = 'core', itemId = 'help-about' } = {}) {
  if (!ideStoreInstance || typeof ideStoreInstance.addLog !== 'function') {
    console.warn('registerDefaultHelpMenu: invalid ideStore instance provided')
    return
  }

  const existingMenu = mainMenuService.getMenu(menuId)
  if (!existingMenu) {
    mainMenuService.registerMenu({ id: menuId, label: 'Aide', order: 900 }, ownerId)
  }

  const menuAfterRegistration = mainMenuService.getMenu(menuId)
  const hasItem = menuAfterRegistration?.items?.some(item => item.id === itemId)

  if (!hasItem) {
    mainMenuService.registerMenuItem(menuId, {
      id: itemId,
      label: 'A propos...',
      order: 100,
      action: () => {
        ideStoreInstance.addLog('Hello', 'info', 'Général')
      }
    }, ownerId)
  }
}

export const ideStore = new IdeStore()
