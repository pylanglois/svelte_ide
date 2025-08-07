export class ZoneRegistry {
  constructor() {
    this.zones = new Map()
    this.zoneInstances = new Map()
  }

  registerZone(id, config) {
    if (!id || !config) {
      throw new Error('Zone registration requires id and config')
    }

    const zoneConfig = {
      id,
      type: config.type || 'custom',
      component: config.component,
      position: config.position,
      resizable: config.resizable ?? true,
      persistable: config.persistable ?? false,
      metadata: config.metadata || {}
    }

    this.zones.set(id, zoneConfig)
    return zoneConfig
  }

  unregisterZone(id) {
    if (this.zones.has(id)) {
      this.zones.delete(id)
      this.zoneInstances.delete(id)
      return true
    }
    return false
  }

  getZone(id) {
    return this.zones.get(id) || null
  }

  getZonesByType(type) {
    return Array.from(this.zones.values()).filter(zone => zone.type === type)
  }

  getZonesByPosition(position) {
    return Array.from(this.zones.values()).filter(zone => zone.position === position)
  }

  getPersistableZones() {
    return Array.from(this.zones.values()).filter(zone => zone.persistable)
  }

  getAllZones() {
    return Array.from(this.zones.values())
  }

  hasZone(id) {
    return this.zones.has(id)
  }

  setZoneInstance(id, instance) {
    if (this.zones.has(id)) {
      this.zoneInstances.set(id, instance)
      return true
    }
    return false
  }

  getZoneInstance(id) {
    return this.zoneInstances.get(id) || null
  }

  updateZoneConfig(id, updates) {
    const zone = this.zones.get(id)
    if (zone) {
      const updatedZone = { ...zone, ...updates }
      this.zones.set(id, updatedZone)
      return updatedZone
    }
    return null
  }

  getZoneCount() {
    return this.zones.size
  }

  getZonesByMetadata(key, value) {
    return Array.from(this.zones.values()).filter(zone => 
      zone.metadata && zone.metadata[key] === value
    )
  }

  clear() {
    this.zones.clear()
    this.zoneInstances.clear()
  }
}

export const zoneRegistry = new ZoneRegistry()
