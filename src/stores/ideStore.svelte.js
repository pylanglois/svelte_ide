import { Tab } from '@/core/Tab.svelte.js'
import { eventBus } from '@/core/EventBusService.svelte.js'
import { layoutService } from '@/core/LayoutService.svelte.js'
import { getAuthStore } from './authStore.svelte.js'

class IDEStore {
  constructor() {
    this.tools = $state([])
    
    this.statusMessage = $state('')
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

  get tabs() {
    return layoutService.tabs
  }

  get activeTab() {
    return layoutService.activeTab
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

  closeTab(tabId) {
    const closedTabId = layoutService.closeTab(tabId)
    if (closedTabId) {
      eventBus.publish('tabs:closed', { tabId: closedTabId })
    }
  }

  reorderTabs(newTabsOrder) {
    layoutService.reorderTabs(newTabsOrder)
  }

  setActiveTab(tabId) {
    const tab = layoutService.setActiveTab(tabId)
    if (tab) {
      eventBus.publish('tabs:activated', tab)
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

  setFocusedPanel(panelType) {
    this.focusedPanel = panelType
  }

  clearFocusedPanel() {
    this.focusedPanel = null
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
      const userName = user.name || user.email || user.id
      const layoutKey = `ide-layout-${userName}`
      const savedData = localStorage.getItem(layoutKey)
      
      if (!savedData) {
        return
      }

      const layoutData = JSON.parse(savedData)
      
      if (layoutData.layout) {
        this.closeAllTabs()
        
        const allTabsData = this._collectTabsFromLayout(layoutData.layout)
        
        const restoredTabs = new Map()
        
        for (const tabData of allTabsData) {
          if (tabData.descriptor) {
            
            const tab = new Tab(tabData.id, tabData.title, null, tabData.closable, tabData.icon)
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
            
            eventBus.publish('tab:hydrate', {
              descriptor: tabData.descriptor,
              tabId: tabData.id,
              hydrateCallback: hydrateCallback,
              userId: userName
            })
          }
        }
        
        const restoredLayout = this._reconstructLayout(layoutData.layout, restoredTabs)
        layoutService.layout = restoredLayout
      }
      
    } catch (error) {
      
    }
  }

  _reconstructLayout(layoutData, tabsMap) {
    if (layoutData.type === 'tabgroup') {
      return {
        ...layoutData,
        tabs: layoutData.tabs.map(tabData => tabsMap.get(tabData.id)).filter(Boolean)
      }
    } else if (layoutData.type === 'container') {
      return {
        ...layoutData,
        children: layoutData.children.map(child => this._reconstructLayout(child, tabsMap))
      }
    }
    return layoutData
  }

  saveUserLayout() {
    if (!this.isAuthenticated || !this.user) return
    
    try {
      const userName = this.user.name || this.user.email || this.user.id
      const layoutKey = `ide-layout-${userName}`
      const serializableLayout = layoutService._createSerializableLayout(layoutService.layout)
      
      if (serializableLayout) {
        const layoutData = {
          layout: serializableLayout,
          timestamp: Date.now(),
          userId: userName
        }
        localStorage.setItem(layoutKey, JSON.stringify(layoutData))
      }
    } catch (error) {
      
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
}

export const ideStore = new IDEStore()

ideStore.addConsoleTab('Général')
