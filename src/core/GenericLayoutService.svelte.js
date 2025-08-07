import { zoneRegistry } from '@/core/layout/ZoneRegistry.svelte.js'
import { persistenceRegistry } from '@/core/PersistenceRegistry.svelte.js'

export class GenericLayoutService {
    constructor() {
        this.zones = new Map()
        this.activeZonesByType = new Map()
        this.focusedZone = null
        this.dragState = {
            draggedItem: null,
            draggedSource: null,
            dragOverZone: null
        }
        
        this.persister = persistenceRegistry.getPersister('layout')
        this.changeCallbacks = new Set()
        this._initializeZoneTypes()
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

    _initializeZoneTypes() {
        const registeredZones = zoneRegistry.getZonesByType()
        
        for (const [type, zoneConfigs] of registeredZones) {
            if (!this.activeZonesByType.has(type)) {
                this.activeZonesByType.set(type, null)
            }
        }
    }

    registerZone(id, zoneConfig) {
        const zone = zoneRegistry.registerZone(id, zoneConfig)
        this.zones.set(zone.id, {
            ...zone,
            content: null,
            isActive: false
        })
        return zone
    }

    activateZone(zoneId, content = null) {
        const zone = this.zones.get(zoneId)
        if (!zone) return false

        const currentActive = this.activeZonesByType.get(zone.type)
        if (currentActive) {
            this.deactivateZone(currentActive.id)
        }

        zone.isActive = true
        zone.content = content
        this.activeZonesByType.set(zone.type, zone)
        this.focusedZone = zoneId
        
        this._saveZoneState(zone)
        this._notifyChange()
        return true
    }

    deactivateZone(zoneId) {
        const zone = this.zones.get(zoneId)
        if (!zone) return false

        zone.isActive = false
        zone.content = null
        
        if (this.activeZonesByType.get(zone.type)?.id === zoneId) {
            this.activeZonesByType.set(zone.type, null)
        }
        
        if (this.focusedZone === zoneId) {
            this.focusedZone = null
        }

        this._saveZoneState(zone)
        this._notifyChange()
        return true
    }

    toggleZone(zoneId, content = null) {
        const zone = this.zones.get(zoneId)
        if (!zone) return false

        if (zone.isActive) {
            return this.deactivateZone(zoneId)
        } else {
            return this.activateZone(zoneId, content)
        }
    }

    getActiveZoneByType(type) {
        return this.activeZonesByType.get(type) || null
    }

    getZonesByType(type) {
        return Array.from(this.zones.values()).filter(zone => zone.type === type)
    }

    getZone(zoneId) {
        return this.zones.get(zoneId) || null
    }

    getAllZones() {
        return Array.from(this.zones.values())
    }

    getActiveZones() {
        return Array.from(this.zones.values()).filter(zone => zone.isActive)
    }

    focusZone(zoneId) {
        const zone = this.zones.get(zoneId)
        if (zone && zone.isActive) {
            this.focusedZone = zoneId
            this._notifyChange()
            return true
        }
        return false
    }

    clearFocus() {
        this.focusedZone = null
        this._notifyChange()
    }

    setDragState(draggedItem, draggedSource, dragOverZone = null) {
        this.dragState.draggedItem = draggedItem
        this.dragState.draggedSource = draggedSource
        this.dragState.dragOverZone = dragOverZone
        this._notifyChange()
    }

    clearDragState() {
        this.dragState.draggedItem = null
        this.dragState.draggedSource = null
        this.dragState.dragOverZone = null
        this._notifyChange()
    }

    moveContentToZone(fromZoneId, toZoneId) {
        const fromZone = this.zones.get(fromZoneId)
        const toZone = this.zones.get(toZoneId)
        
        if (!fromZone || !toZone || fromZone.type !== toZone.type) {
            return false
        }

        const content = fromZone.content
        this.deactivateZone(fromZoneId)
        this.activateZone(toZoneId, content)
        
        return true
    }

    _saveZoneState(zone) {
        if (!zone.persistent) return

        const stateKey = `zone-${zone.id}`
        const state = {
            isActive: zone.isActive,
            lastActivated: zone.isActive ? Date.now() : null
        }
        
        this.persister.save(stateKey, state)
    }

    restoreZoneStates() {
        const persistableZones = zoneRegistry.getPersistableZones()
        
        persistableZones.forEach(zoneConfig => {
            const stateKey = `zone-${zoneConfig.id}`
            const savedState = this.persister.load(stateKey)
            
            if (savedState && savedState.isActive) {
                const zone = this.zones.get(zoneConfig.id)
                if (zone) {
                    this.activateZone(zone.id)
                }
            }
        })
    }

    clearPersistedStates() {
        const persistableZones = zoneRegistry.getPersistableZones()
        
        persistableZones.forEach(zoneConfig => {
            const stateKey = `zone-${zoneConfig.id}`
            this.persister.remove(stateKey)
        })
    }

    getZoneTypes() {
        return Array.from(zoneRegistry.getZonesByType().keys())
    }

    getZoneTypeConfig(type) {
        return zoneRegistry.getZoneTypeConfig(type)
    }
}

export const genericLayoutService = new GenericLayoutService()
