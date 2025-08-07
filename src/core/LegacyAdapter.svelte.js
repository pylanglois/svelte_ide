import { genericLayoutService } from '@/core/GenericLayoutService.svelte.js'
import { tabsManager } from '@/core/TabsManager.svelte.js'
import { panelsManager } from '@/core/PanelsManager.svelte.js'
import { zoneRegistry } from '@/core/layout/ZoneRegistry.svelte.js'

export class LegacyAdapter {
    constructor(oldIdeStore) {
        this.oldStore = oldIdeStore
        this.isNewSystemEnabled = false
        this.changeCallbacks = new Set()
        this.genericLayoutService = genericLayoutService
        this.panelsManager = panelsManager
        this.tabsManager = tabsManager
        this._initializeZones()
    }

    addChangeCallback(callback) {
        this.changeCallbacks.add(callback)
    }

    removeChangeCallback(callback) {
        this.changeCallbacks.delete(callback)
    }

    _notifyChange() {
        this.changeCallbacks.forEach(callback => callback())
    }

    _initializeZones() {
        const defaultZones = [
            { id: 'topLeft', type: 'panel', position: 'topLeft', persistent: true },
            { id: 'bottomLeft', type: 'panel', position: 'bottomLeft', persistent: true },
            { id: 'topRight', type: 'panel', position: 'topRight', persistent: true },
            { id: 'bottomRight', type: 'panel', position: 'bottomRight', persistent: true },
            { id: 'bottom', type: 'panel', position: 'bottom', persistent: true },
            { id: 'main', type: 'tabs', position: 'center', persistent: true }
        ]

        defaultZones.forEach(zone => {
            zoneRegistry.registerZone(zone.id, {
                type: zone.type,
                position: zone.position,
                persistent: zone.persistent
            })
            panelsManager.registerPanel({
                id: zone.id,
                position: zone.position,
                persistent: zone.persistent,
                title: this._getZoneTitle(zone.id),
                icon: this._getZoneIcon(zone.id)
            })
        })
    }

    _getZoneTitle(zoneId) {
        const titles = {
            topLeft: 'Panneau Haut Gauche',
            bottomLeft: 'Panneau Bas Gauche',
            topRight: 'Panneau Haut Droite',
            bottomRight: 'Panneau Bas Droite',
            bottom: 'Panneau Bas',
            main: 'Zone Principale'
        }
        return titles[zoneId] || zoneId
    }

    _getZoneIcon(zoneId) {
        const icons = {
            topLeft: '📁',
            bottomLeft: '🔧',
            topRight: '⚙️',
            bottomRight: '📊',
            bottom: '🖥️',
            main: '📄'
        }
        return icons[zoneId] || '📋'
    }

    toggleTool(toolId) {
        if (this.isNewSystemEnabled) {
            return this._toggleToolNewSystem(toolId)
        } else {
            return this.oldStore.toggleTool(toolId)
        }
    }

    _toggleToolNewSystem(toolId) {
        const tool = this.oldStore.tools.find(t => t.id === toolId)
        if (!tool) return

        const panelId = tool.position
        const currentActive = panelsManager.getActivePanelByPosition(panelId)

        if (currentActive && currentActive.toolId === toolId) {
            panelsManager.deactivatePanel(panelId)
        } else {
            panelsManager.activatePanel(panelId, tool.component)
            this._updateLegacyState(panelId, tool)
        }
    }

    _updateLegacyState(panelId, tool) {
        this.oldStore.activeToolsByPosition[panelId] = tool
        this.oldStore.focusedPanel = panelId
    }

    addTab(tab) {
        if (this.isNewSystemEnabled) {
            return tabsManager.addTab(tab)
        } else {
            return this.oldStore.addTab(tab)
        }
    }

    closeTab(tabId) {
        if (this.isNewSystemEnabled) {
            return tabsManager.closeTab(tabId)
        } else {
            return this.oldStore.closeTab(tabId)
        }
    }

    setActiveTab(tabId) {
        if (this.isNewSystemEnabled) {
            return tabsManager.setActiveTab(tabId)
        } else {
            return this.oldStore.setActiveTab(tabId)
        }
    }

    enableNewSystem() {
        this.isNewSystemEnabled = true
        this._migrateCurrentState()
    }

    disableNewSystem() {
        this.isNewSystemEnabled = false
    }

    _migrateCurrentState() {
        Object.entries(this.oldStore.activeToolsByPosition).forEach(([position, tool]) => {
            if (tool) {
                panelsManager.activatePanel(position, tool.component)
            }
        })

        if (this.oldStore.tabs.length > 0) {
            this.oldStore.tabs.forEach(tab => {
                tabsManager.addTab(tab)
            })
            
            if (this.oldStore.activeTab) {
                tabsManager.setActiveTab(this.oldStore.activeTab)
            }
        }
    }

    getSystemStatus() {
        return {
            isNewSystemEnabled: this.isNewSystemEnabled,
            registeredZones: zoneRegistry.getAllZones().length,
            activePanels: panelsManager.getActivePanels().length,
            totalTabs: this.isNewSystemEnabled ? tabsManager.tabs.length : this.oldStore.tabs.length
        }
    }
}

export function createLegacyAdapter(ideStore) {
    return new LegacyAdapter(ideStore)
}
