import { Tab } from '../core/Tool.svelte.js'

class IDEStore {
  constructor() {
    this.leftTools = $state([])
    this.rightTools = $state([])
    this.tabs = $state([])
    this.activeTab = $state(null)
    this.leftPanelVisible = $state(false)
    this.rightPanelVisible = $state(false)
    this.consolePanelVisible = $state(true)
    this.statusMessage = $state('')
    this.user = $state(null)
    this.consoleTabs = $state([])
    this.activeConsoleTab = $state(null)
    this._logIdCounter = 0
    this.activeLeftTool = $state(null)
    this.activeRightTool = $state(null)
    this.focusedPanel = $state(null) // 'left', 'right', 'console' ou null
    
    // Système de notifications
    this.notifications = $state([])
    this.unreadNotificationsCount = $state(0)
    this.notificationsPanelVisible = $state(false)
    this._notificationIdCounter = 0
    
    // Items génériques pour les barres d'outils
    this.rightToolbarItems = $state([])
    
    // Préférences utilisateur (supprimées pour simplifier)
    this.userPreferences = $state({})
  }

  addLeftTool(tool) {
    // Éviter les doublons
    if (!this.leftTools.find(t => t.id === tool.id)) {
      this.leftTools.push(tool)
    }
  }

  addRightTool(tool) {
    // Éviter les doublons
    if (!this.rightTools.find(t => t.id === tool.id)) {
      this.rightTools.push(tool)
    }
  }

  removeLeftTool(toolId) {
    const index = this.leftTools.findIndex(tool => tool.id === toolId)
    if (index !== -1) {
      this.leftTools.splice(index, 1)
    }
  }

  removeRightTool(toolId) {
    const index = this.rightTools.findIndex(tool => tool.id === toolId)
    if (index !== -1) {
      this.rightTools.splice(index, 1)
    }
  }

  toggleLeftPanel(toolId = null) {
    // if (toolId) {
    //   const tool = this.leftTools.find(t => t.id === toolId)
    //   if (tool) {
    //     const wasActive = tool.active
    //
    //     this.leftTools.forEach(t => {
    //       if (t.id !== toolId && t.active) {
    //         t.active = false
    //         t.deactivate()
    //       }
    //     })
    //
    //     tool.active = !wasActive
    //     if (tool.active) {
    //       tool.activate()
    //       this.activeLeftTool = tool
    //     } else {
    //       tool.deactivate()
    //       this.activeLeftTool = null
    //     }
    //
    //     this.leftPanelVisible = this.leftTools.some(t => t.active)
    //   }
    // } else {
    //   this.leftPanelVisible = !this.leftPanelVisible
    // }
  }

  toggleRightPanel(toolId = null) {
    // if (toolId) {
    //   const tool = this.rightTools.find(t => t.id === toolId)
    //   if (tool) {
    //     const wasActive = tool.active
    //
    //     // Désactiver tous les autres outils
    //     this.rightTools.forEach(t => {
    //       if (t.id !== toolId && t.active) {
    //         t.active = false
    //         t.deactivate()
    //       }
    //     })
    //
    //     // Basculer l'état de l'outil sélectionné
    //     tool.active = !wasActive
    //     if (tool.active) {
    //       tool.activate()
    //       this.activeRightTool = tool
    //     } else {
    //       tool.deactivate()
    //       this.activeRightTool = null
    //     }
    //
    //     // Mettre à jour la visibilité du panneau
    //     this.rightPanelVisible = this.rightTools.some(t => t.active)
    //   }
    // } else {
    //   // Basculer simplement la visibilité du panneau
    //   this.rightPanelVisible = !this.rightPanelVisible
    // }
  }

  toggleConsolePanel() {
    this.consolePanelVisible = !this.consolePanelVisible
  }

  // // Méthodes pour les items génériques de la barre d'outils droite
  // addRightToolbarItem(item) {
  //   this.rightToolbarItems.push(item)
  // }

  // removeRightToolbarItem(itemId) {
  //   const index = this.rightToolbarItems.findIndex(item => item.id === itemId)
  //   if (index !== -1) {
  //     this.rightToolbarItems.splice(index, 1)
  //   }
  // }

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

  addTab(tab) {
    const existingTab = this.tabs.find(t => t.id === tab.id)
    if (!existingTab) {
      this.tabs.push(tab)
    }
    this.activeTab = tab.id
  }

  addTabFromTool(toolId, tabId, title, component, closable = true, additionalProps = {}) {
    const tool = [...this.leftTools, ...this.rightTools].find(t => t.id === toolId)
    const toolIcon = tool ? tool.icon : null
    
    const tab = new (class extends Tab {
      constructor() {
        super(tabId, title, component, closable, toolIcon)
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
      authType: 'temporary' // Sera 'oauth' quand le système sera intégré
    }
  }

  logout() {
    if (this.user) {
      // Ici on pourrait ajouter des actions de nettoyage
      // comme la fermeture de tous les onglets, etc.
      this.closeAllTabs()
    }
    this.user = null
  }

  // Méthode pour préparer l'intégration OAuth future
  async loginWithOAuth(provider = 'default') {
    // Cette méthode sera remplacée par l'appel réel au microservice
    // Pour l'instant, on peut juste retourner une promesse
    return new Promise((resolve, reject) => {
      // Simulation d'un appel OAuth
      this.addNotification(
        'OAuth',
        `Redirection vers ${provider} en cours...`,
        'info',
        'Authentification'
      )
      
      // Ici, le futur développeur ajoutera :
      // 1. Redirection vers le provider OAuth
      // 2. Gestion du callback
      // 3. Récupération du token
      // 4. Appel au microservice d'authentification
      
      setTimeout(() => {
        reject(new Error('OAuth non implémenté - utiliser la connexion temporaire'))
      }, 1000)
    })
  }

  closeAllTabs() {
    this.tabs = []
    this.activeTab = null
  }

  addLog(message, type = 'info', tabTitle = 'Général') {
    const consoleTab = this.addConsoleTab(tabTitle)
    consoleTab.logs.push({
      id: ++this._logIdCounter,
      message,
      type,
      timestamp: new Date()
    })
    
    // Forcer la réactivité en recréant le tableau
    this.consoleTabs = [...this.consoleTabs]
  }

  // Méthodes pour les notifications
  addNotification(title, message, type = 'info', source = 'IDE') {
    const notification = {
      id: ++this._notificationIdCounter,
      title,
      message,
      type, // info, warning, error, success
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

  toggleNotificationsPanel() {
    // Désactiver tous les outils de droite si on ouvre les notifications
    if (!this.notificationsPanelVisible) {
      this.rightTools.forEach(t => {
        if (t.active) {
          t.active = false
          t.deactivate()
        }
      })
    }
    
    this.notificationsPanelVisible = !this.notificationsPanelVisible
    this.rightPanelVisible = this.notificationsPanelVisible || this.rightTools.some(t => t.active)
    
    if (this.notificationsPanelVisible) {
      this.setStatusMessage('Notifications ouvertes')
    } else {
      this.setStatusMessage('Notifications fermées')
    }
  }

  // Méthodes supprimées pour simplifier
}

export const ideStore = new IDEStore()

// Créer un onglet de console par défaut
ideStore.addConsoleTab('Général')
