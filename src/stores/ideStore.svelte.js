import { Tab } from '@/core/Tab.svelte.js'
import { eventBus } from '@/core/EventBusService.svelte.js'
import { layoutService } from '@/core/LayoutService.svelte.js'

class IDEStore {
  constructor() {
    this.tools = $state([])
    // ANCIEN SYSTÈME : on garde pour compatibilité mais on délègue au LayoutService
    this._tabs = $state([])
    this._activeTab = $state(null)
    
    this.statusMessage = $state('')
    this.user = $state(null)
    this.focusedPanel = $state(null)

    this.draggedTool = $state(null)
    this.draggedToolSource = $state(null)
    this.dragOverZone = $state(null)

    this.activeToolsByPosition = $state({
      topLeft: null,
      bottomLeft: null,
      topRight: null,
      bottomRight: null,
      bottom: null
    })

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
    
    this._updateToolLists()
  }

  // WRAPPER DE COMPATIBILITÉ : API identique mais délègue au LayoutService
  get tabs() {
    return layoutService.tabs
  }

  get activeTab() {
    return layoutService.activeTab
  }

  _updateToolLists() {
    this.topLeftTools = this.tools.filter(t => t.position === 'topLeft')
    this.bottomLeftTools = this.tools.filter(t => t.position === 'bottomLeft')
    this.topRightTools = this.tools.filter(t => t.position === 'topRight')
    this.bottomRightTools = this.tools.filter(t => t.position === 'bottomRight')
    this.bottomTools = this.tools.filter(t => t.position === 'bottom')
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

  moveTool(toolId, newPosition) {
    const tool = this.tools.find(t => t.id === toolId)
    if (tool && this.activeToolsByPosition.hasOwnProperty(newPosition)) {
      tool.setPosition(newPosition)
      this._updateToolLists()
    }
  }

  toggleTool(toolId) {
    const tool = this.tools.find(t => t.id === toolId)
    if (!tool) return

    const position = tool.position
    const currentlyActiveTool = this.activeToolsByPosition[position]

    if (currentlyActiveTool) {
      currentlyActiveTool.deactivate()
    }

    if (currentlyActiveTool?.id !== tool.id) {
      tool.activate()
      this.activeToolsByPosition[position] = tool
      this.focusedPanel = position
    } else {
      this.activeToolsByPosition[position] = null
      if (this.focusedPanel === position) {
        this.focusedPanel = null
      }
    }
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
    // DÉLÉGATION : on utilise le LayoutService mais on garde les events
    layoutService.addTab(tab)
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

  openFile({ fileName, content, component, icon = '📄', toolId = null }) {
    const tabId = this._generateTabId()
    
    const tab = new Tab(tabId, fileName, component, true, icon)
    tab.fileName = fileName
    tab.content = content
    tab.originalContent = content
    tab.toolId = toolId
    tab.onContentChange = (newContent) => this._handleContentChange(tabId, newContent)
    tab.onDirtyStateChange = (isDirty) => this._handleDirtyState(tabId, isDirty)
    
    this.addTab(tab)
    return tab
  }

  closeTab(tabId) {
    // DÉLÉGATION : on utilise le LayoutService mais on garde les events
    const closedTabId = layoutService.closeTab(tabId)
    if (closedTabId) {
      eventBus.publish('tabs:closed', { tabId: closedTabId })
    }
  }

  reorderTabs(newTabsOrder) {
    // DÉLÉGATION : on utilise le LayoutService
    layoutService.reorderTabs(newTabsOrder)
  }

  setActiveTab(tabId) {
    // DÉLÉGATION : on utilise le LayoutService mais on garde les events
    const tab = layoutService.setActiveTab(tabId)
    if (tab) {
      eventBus.publish('tabs:activated', tab)
    } else if (tabId === null) {
      eventBus.publish('tabs:activated', null)
    }
  }

  getTabById(tabId) {
    // DÉLÉGATION : on utilise le LayoutService
    return layoutService.getTabById(tabId)
  }

  setTabModified(tabId, modified) {
    // DÉLÉGATION : on utilise le LayoutService mais on garde les events
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

  setFocusedPanel(panelType) {
    this.focusedPanel = panelType
  }

  clearFocusedPanel() {
    this.focusedPanel = null
  }

  setStatusMessage(message) {
    this.statusMessage = message
  }

  login(user) {
    this.user = {
      ...user,
      loginTime: new Date().toISOString(),
      authType: 'temporary'
    }
  }

  logout() {
    if (this.user) {
      this.closeAllTabs()
    }
    this.user = null
  }

  closeAllTabs() {
    this.tabs = []
    this.activeTab = null
  }

  // Sauvegarder la disposition dans localStorage
  saveLayout() {
    try {
      const layoutData = {
        layout: layoutService.layout,
        timestamp: Date.now()
      }
      localStorage.setItem('ide-layout', JSON.stringify(layoutData))
    } catch (error) {
      console.warn('Impossible de sauvegarder la disposition:', error)
    }
  }

  // Restaurer la disposition depuis localStorage
  restoreLayout() {
    try {
      const savedData = localStorage.getItem('ide-layout')
      if (savedData) {
        const { layout } = JSON.parse(savedData)
        // Vérifier que le layout est valide avant de l'appliquer
        if (layout && layout.type && layout.id) {
          layoutService.layout = layout
          return true
        }
      }
    } catch (error) {
      console.warn('Impossible de restaurer la disposition:', error)
    }
    return false
  }

  // Réinitialiser la disposition
  resetLayout() {
    layoutService.layout = {
      type: 'tabgroup',
      id: 'main',
      tabs: [],
      activeTab: null
    }
    this.saveLayout()
  }
}

export const ideStore = new IDEStore()

ideStore.addConsoleTab('Général')
