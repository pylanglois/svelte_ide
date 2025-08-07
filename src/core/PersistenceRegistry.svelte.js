import { LocalStoragePersister, MemoryPersister } from '@/core/PersisterInterface.js'

export class PersistenceRegistry {
    constructor() {
        this.persisters = new Map()
        this.defaultPersisterType = 'localStorage'
    }

    registerPersister(namespace, persister) {
        if (!namespace) {
            throw new Error('Namespace is required')
        }
        if (!persister || typeof persister.save !== 'function') {
            throw new Error('Persister must implement the PersisterInterface')
        }
        
        this.persisters.set(namespace, persister)
        return persister
    }

    createPersister(namespace, type = this.defaultPersisterType) {
        if (this.persisters.has(namespace)) {
            return this.persisters.get(namespace)
        }

        let persister
        switch (type) {
            case 'localStorage':
                persister = new LocalStoragePersister(namespace)
                break
            case 'memory':
                persister = new MemoryPersister(namespace)
                break
            default:
                throw new Error(`Unknown persister type: ${type}`)
        }

        this.registerPersister(namespace, persister)
        return persister
    }

    getPersister(namespace) {
        if (!this.persisters.has(namespace)) {
            return this.createPersister(namespace)
        }
        return this.persisters.get(namespace)
    }

    removePersister(namespace) {
        return this.persisters.delete(namespace)
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
