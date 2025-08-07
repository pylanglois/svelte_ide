export class PersisterInterface {
    constructor(namespace) {
        if (!namespace) {
            throw new Error('PersisterInterface requires a namespace')
        }
        this.namespace = namespace
    }

    save(key, data) {
        throw new Error('save() must be implemented by subclass')
    }

    load(key, defaultValue = null) {
        throw new Error('load() must be implemented by subclass')
    }

    remove(key) {
        throw new Error('remove() must be implemented by subclass')
    }

    clear() {
        throw new Error('clear() must be implemented by subclass')
    }

    exists(key) {
        throw new Error('exists() must be implemented by subclass')
    }

    getFullKey(key) {
        return `${this.namespace}-${key}`
    }
}

export class LocalStoragePersister extends PersisterInterface {
    constructor(namespace) {
        super(namespace)
    }

    save(key, data) {
        try {
            const fullKey = this.getFullKey(key)
            const serialized = JSON.stringify(data)
            localStorage.setItem(fullKey, serialized)
            return true
        } catch (error) {
            console.error(`Failed to save ${key}:`, error)
            return false
        }
    }

    load(key, defaultValue = null) {
        try {
            const fullKey = this.getFullKey(key)
            const serialized = localStorage.getItem(fullKey)
            if (serialized === null) {
                return defaultValue
            }
            return JSON.parse(serialized)
        } catch (error) {
            console.error(`Failed to load ${key}:`, error)
            return defaultValue
        }
    }

    remove(key) {
        try {
            const fullKey = this.getFullKey(key)
            localStorage.removeItem(fullKey)
            return true
        } catch (error) {
            console.error(`Failed to remove ${key}:`, error)
            return false
        }
    }

    clear() {
        try {
            const keys = []
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i)
                if (key && key.startsWith(`${this.namespace}-`)) {
                    keys.push(key)
                }
            }
            keys.forEach(key => localStorage.removeItem(key))
            return true
        } catch (error) {
            console.error(`Failed to clear namespace ${this.namespace}:`, error)
            return false
        }
    }

    exists(key) {
        const fullKey = this.getFullKey(key)
        return localStorage.getItem(fullKey) !== null
    }
}

export class MemoryPersister extends PersisterInterface {
    constructor(namespace) {
        super(namespace)
        this.storage = new Map()
    }

    save(key, data) {
        try {
            const fullKey = this.getFullKey(key)
            this.storage.set(fullKey, JSON.parse(JSON.stringify(data)))
            return true
        } catch (error) {
            console.error(`Failed to save ${key}:`, error)
            return false
        }
    }

    load(key, defaultValue = null) {
        const fullKey = this.getFullKey(key)
        if (!this.storage.has(fullKey)) {
            return defaultValue
        }
        try {
            const data = this.storage.get(fullKey)
            return JSON.parse(JSON.stringify(data))
        } catch (error) {
            console.error(`Failed to load ${key}:`, error)
            return defaultValue
        }
    }

    remove(key) {
        const fullKey = this.getFullKey(key)
        return this.storage.delete(fullKey)
    }

    clear() {
        const keysToDelete = []
        for (const key of this.storage.keys()) {
            if (key.startsWith(`${this.namespace}-`)) {
                keysToDelete.push(key)
            }
        }
        keysToDelete.forEach(key => this.storage.delete(key))
        return true
    }

    exists(key) {
        const fullKey = this.getFullKey(key)
        return this.storage.has(fullKey)
    }
}
