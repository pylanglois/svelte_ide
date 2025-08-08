import { genericLayoutService } from '@/core/GenericLayoutService.svelte.js'
import { zoneRegistry } from '@/core/layout/ZoneRegistry.svelte.js'

export class PanelsManager {
    constructor() {
        this.panels = new Map()
        this.activePanelsByPosition = new Map()
        this.focusedPanel = null
        this.changeCallbacks = new Set()
        
        this._initializePanelPositions()
    }

    addChangeCallback(callback) {
        this.changeCallbacks.add(callback)
    }

    removeChangeCallback(callback) {
        this.changeCallbacks.delete(callback)
    }

    _notifyChange() {
        console.log(`🔔 PanelsManager._notifyChange() appelée, callbacks:`, this.changeCallbacks.size)
        this.changeCallbacks.forEach(callback => {
            console.log(`📞 Appel callback...`)
            try {
                callback()
                console.log(`✅ Callback exécuté avec succès`)
            } catch (error) {
                console.error(`❌ Erreur callback:`, error)
            }
        })
    }

    _initializePanelPositions() {
        const panelPositions = ['topLeft', 'bottomLeft', 'topRight', 'bottomRight', 'bottom']
        panelPositions.forEach(position => {
            this.activePanelsByPosition.set(position, null)
        })
    }

    registerPanel(panelConfig) {
        if (!panelConfig.id || !panelConfig.position) {
            throw new Error('Panel config must have id and position')
        }

        const zoneConfig = {
            id: panelConfig.id,
            type: 'panel',
            position: panelConfig.position,
            persistent: panelConfig.persistent !== false,
            metadata: {
                title: panelConfig.title || panelConfig.id,
                icon: panelConfig.icon || '📋',
                component: panelConfig.component,
                toolId: panelConfig.toolId
            }
        }

        const zone = genericLayoutService.registerZone(panelConfig.id, zoneConfig)
        
        this.panels.set(panelConfig.id, {
            ...panelConfig,
            zoneId: zone.id,
            isActive: false
        })

        return zone
    }

    activatePanel(panelId, component = null) {
        console.log(`🔧 PanelsManager.activatePanel(${panelId})`)
        const panel = this.panels.get(panelId)
        if (!panel) {
            console.warn(`❌ Panel ${panelId} non trouvé dans panels:`, Array.from(this.panels.keys()))
            return false
        }

        console.log(`🔧 Panel trouvé:`, panel)
        const currentActive = this.activePanelsByPosition.get(panel.position)
        if (currentActive) {
            console.log(`🔧 Désactivation panel actuel:`, currentActive.id)
            this.deactivatePanel(currentActive.id)
        }

        const content = component || panel.component
        console.log(`🔧 Activation zone ${panel.zoneId} avec composant:`, !!content)
        const success = genericLayoutService.activateZone(panel.zoneId, content)
        
        if (success) {
            panel.isActive = true
            this.activePanelsByPosition.set(panel.position, panel)
            this.focusedPanel = panelId
            console.log(`🔧 Panel activé, état mis à jour:`, panel.position, panel.id)
            console.log(`🔧 activePanelsByPosition après activation:`, this.activePanelsByPosition)
            this._notifyChange()
            console.log(`🔔 Notification envoyée`)
        } else {
            console.warn(`❌ Échec activation zone ${panel.zoneId}`)
        }

        return success
    }

    deactivatePanel(panelId) {
        const panel = this.panels.get(panelId)
        if (!panel) return false

        const success = genericLayoutService.deactivateZone(panel.zoneId)
        
        if (success) {
            panel.isActive = false
            
            if (this.activePanelsByPosition.get(panel.position)?.id === panelId) {
                this.activePanelsByPosition.set(panel.position, null)
            }
            
            if (this.focusedPanel === panelId) {
                this.focusedPanel = null
            }
            this._notifyChange()
        }

        return success
    }

    togglePanel(panelId, component = null) {
        const panel = this.panels.get(panelId)
        if (!panel) return false

        if (panel.isActive) {
            return this.deactivatePanel(panelId)
        } else {
            return this.activatePanel(panelId, component)
        }
    }

    getPanel(panelId) {
        return this.panels.get(panelId) || null
    }

    getPanelsByPosition(position) {
        return Array.from(this.panels.values()).filter(panel => panel.position === position)
    }

    getActivePanelByPosition(position) {
        return this.activePanelsByPosition.get(position) || null
    }

    getAllPanels() {
        return Array.from(this.panels.values())
    }

    getActivePanels() {
        return Array.from(this.panels.values()).filter(panel => panel.isActive)
    }

    focusPanel(panelId) {
        const panel = this.panels.get(panelId)
        if (panel && panel.isActive) {
            this.focusedPanel = panelId
            genericLayoutService.focusZone(panel.zoneId)
            this._notifyChange()
            return true
        }
        return false
    }

    clearFocus() {
        this.focusedPanel = null
        genericLayoutService.clearFocus()
        this._notifyChange()
    }

    movePanelToPosition(panelId, newPosition) {
        const panel = this.panels.get(panelId)
        if (!panel || !this._isValidPosition(newPosition)) {
            return false
        }

        const wasActive = panel.isActive
        const component = wasActive ? genericLayoutService.getZone(panel.zoneId)?.content : null

        if (wasActive) {
            this.deactivatePanel(panelId)
        }

        panel.position = newPosition

        const newZoneConfig = {
            id: panel.id,
            type: 'panel',
            position: newPosition,
            persistent: panel.persistent !== false,
            metadata: {
                title: panel.title || panel.id,
                icon: panel.icon || '📋',
                component: panel.component,
                toolId: panel.toolId
            }
        }

        const newZone = genericLayoutService.registerZone(`${panelId}-new`, newZoneConfig)
        panel.zoneId = newZone.id

        if (wasActive) {
            this.activatePanel(panelId, component)
        }

        return true
    }

    _isValidPosition(position) {
        return ['topLeft', 'bottomLeft', 'topRight', 'bottomRight', 'bottom'].includes(position)
    }

    unregisterPanel(panelId) {
        const panel = this.panels.get(panelId)
        if (!panel) return false

        if (panel.isActive) {
            this.deactivatePanel(panelId)
        }

        this.panels.delete(panelId)
        return true
    }

    restorePanelStates() {
        genericLayoutService.restoreZoneStates()
        
        this.panels.forEach((panel, panelId) => {
            const zone = genericLayoutService.getZone(panel.zoneId)
            if (zone && zone.isActive) {
                panel.isActive = true
                this.activePanelsByPosition.set(panel.position, panel)
            }
        })
    }

    saveCurrentState() {
        const activePanels = this.getActivePanels()
        return {
            activePanels: activePanels.map(panel => ({
                id: panel.id,
                position: panel.position
            })),
            focusedPanel: this.focusedPanel
        }
    }

    restoreState(state) {
        if (!state) return

        this.getAllPanels().forEach(panel => {
            if (panel.isActive) {
                this.deactivatePanel(panel.id)
            }
        })

        if (state.activePanels) {
            state.activePanels.forEach(({ id }) => {
                this.activatePanel(id)
            })
        }

        if (state.focusedPanel) {
            this.focusPanel(state.focusedPanel)
        }
    }

    deactivateAllPanels() {
        const deactivatedPanels = []
        
        this.panels.forEach((panel, panelId) => {
            if (panel.isActive) {
                this.deactivatePanel(panelId)
                deactivatedPanels.push(panelId)
            }
        })
        
        return deactivatedPanels
    }

    getRegisteredPanels() {
        const registered = []
        this.panels.forEach((panel, panelId) => {
            registered.push({
                id: panelId,
                title: panel.title,
                icon: panel.icon,
                position: panel.position,
                isActive: panel.isActive,
                persistent: panel.persistent
            })
        })
        return registered
    }

    getFocusedPanel() {
        return this.focusedPanel
    }

    hasActivePanelsInPosition(position) {
        return this.activePanelsByPosition.has(position) && 
               this.activePanelsByPosition.get(position) !== null
    }
}

export const panelsManager = new PanelsManager()
