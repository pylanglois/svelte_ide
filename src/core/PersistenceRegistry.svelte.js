import { LocalStoragePersister, MemoryPersister } from '@/core/PersisterInterface.js'
import { APP_KEY } from '@/core/config/appKey.js'

export class PersistenceRegistry {
    constructor() {
        this.persisters = new Map()
        this.defaultPersisterType = 'localStorage'
        this.namespacePrefix = null
        this.setNamespacePrefix(APP_KEY)
    }

    setNamespacePrefix(prefix) {
        if (prefix && typeof prefix !== 'string') {
            throw new Error('Namespace prefix must be a string')
        }
        if (this.persisters.size > 0) {
            console.warn('Namespace prefix set after persisters were created; existing persisters keep their current namespace')
        }
        this.namespacePrefix = prefix && prefix.length > 0 ? prefix : null
    }

    _getMapKey(namespace) {
        return this.namespacePrefix ? `${this.namespacePrefix}::${namespace}` : namespace
    }

    _getEffectiveNamespace(namespace) {
        return this.namespacePrefix ? `${this.namespacePrefix}:${namespace}` : namespace
    }

    registerPersister(namespace, persister) {
        if (!namespace) {
            throw new Error('Namespace is required')
        }
        if (!persister || typeof persister.save !== 'function') {
            throw new Error('Persister must implement the PersisterInterface')
        }
        
        const mapKey = this._getMapKey(namespace)
        this.persisters.set(mapKey, persister)
        return persister
    }

    createPersister(namespace, type = this.defaultPersisterType) {
        const mapKey = this._getMapKey(namespace)
        if (this.persisters.has(mapKey)) {
            return this.persisters.get(mapKey)
        }

        let persister
        switch (type) {
            case 'localStorage':
                persister = new LocalStoragePersister(this._getEffectiveNamespace(namespace))
                break
            case 'memory':
                persister = new MemoryPersister(this._getEffectiveNamespace(namespace))
                break
            default:
                throw new Error(`Unknown persister type: ${type}`)
        }

        this.registerPersister(namespace, persister)
        return persister
    }

    getPersister(namespace) {
        const mapKey = this._getMapKey(namespace)
        if (!this.persisters.has(mapKey)) {
            return this.createPersister(namespace)
        }
        return this.persisters.get(mapKey)
    }

    removePersister(namespace) {
        const mapKey = this._getMapKey(namespace)
        return this.persisters.delete(mapKey)
    }

    clearAll() {
        this.persisters.forEach(persister => {
            try {
                persister.clear()
            } catch (error) {
                console.error(`Failed to clear persister:`, error)
            }
        })
    }

    getRegisteredNamespaces() {
        return Array.from(this.persisters.keys())
    }

    save(namespace, key, data) {
        const persister = this.getPersister(namespace)
        return persister.save(key, data)
    }

    load(namespace, key, defaultValue = null) {
        const persister = this.getPersister(namespace)
        return persister.load(key, defaultValue)
    }

    remove(namespace, key) {
        const persister = this.getPersister(namespace)
        return persister.remove(key)
    }

    exists(namespace, key) {
        const persister = this.getPersister(namespace)
        return persister.exists(key)
    }

    setDefaultPersisterType(type) {
        if (!['localStorage', 'memory'].includes(type)) {
            throw new Error(`Invalid persister type: ${type}`)
        }
        this.defaultPersisterType = type
    }
}

export const persistenceRegistry = new PersistenceRegistry()
