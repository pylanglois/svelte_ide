import { Tab } from '@/core/Tab.svelte.js'
import { eventBus } from '@/core/EventBusService.svelte.js'

class IDEStore {
  constructor() {
    this.tools = $state([])
    this.tabs = $state([])
    this.activeTab = $state(null)
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
    const existingTab = this.tabs.find(t => t.id === tab.id)
    if (!existingTab) {
      this.tabs.push(tab)
    }
    this.activeTab = tab.id
  }

  addTabFromTool(toolId, tabId, title, component, { closable = true, icon = null, ...additionalProps } = {}) {
    const tab = new (class extends Tab {
      constructor() {
        super(tabId, title, component, closable, icon)
        Object.assign(this, additionalProps)
      }
    })()
    
    this.addTab(tab)
    return tab
  }

  closeTab(tabId) {
    const index = this.tabs.findIndex(tab => tab.id === tabId)
    if (index !== -1) {
      this.tabs.splice(index, 1)
      eventBus.publish('tabs:closed', { tabId })
      if (this.activeTab === tabId) {
        this.activeTab = this.tabs.length > 0 ? this.tabs[this.tabs.length - 1].id : null
      }
    }
  }

  reorderTabs(newTabsOrder) {
    this.tabs = newTabsOrder
  }

  setActiveTab(tabId) {
    this.activeTab = tabId
    eventBus.publish('tabs:activated', { tabId })
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
}

export const ideStore = new IDEStore()

ideStore.addConsoleTab('Général')
