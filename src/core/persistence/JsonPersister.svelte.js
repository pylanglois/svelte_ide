import { indexedDBService } from '@/core/persistence/IndexedDBService.svelte.js'
import { LocalStoragePersister, MemoryPersister, PersisterInterface } from '@/core/persistence/PersisterInterface.js'

const ENV_FALLBACK = (import.meta.env.VITE_INDEXEDDB_FALLBACK_STRATEGY || 'block').toLowerCase()
const ALLOWED_STRATEGIES = ['block', 'localstorage', 'memory']
const EXPORT_FORMAT = 'svelte-ide-json-store'

function sanitizeStoreName(namespace) {
  return `json_${namespace.replace(/[^a-z0-9_-]/gi, '_')}`
}

function createFallbackPersister(namespace, strategy) {
  const normalized = strategy?.toLowerCase() || 'block'

  if (!ALLOWED_STRATEGIES.includes(normalized)) {
    console.error(`JsonPersister: Unknown fallback strategy "${strategy}", using 'block'`)
    throw new Error(`IndexedDB is required but not available for namespace "${namespace}"`)
  }

  switch (normalized) {
    case 'block':
      console.error(`JsonPersister: IndexedDB required but unavailable for "${namespace}"`)
      throw new Error(`IndexedDB is required but not available for namespace "${namespace}"`)

    case 'localstorage':
      console.warn(`JsonPersister: Falling back to localStorage for "${namespace}" (unencrypted, low quota)`)
      return new LocalStoragePersister(namespace)

    case 'memory':
      console.warn(`JsonPersister: Falling back to in-memory storage for "${namespace}" (lost on reload)`)
      return new MemoryPersister(namespace)

    default:
      throw new Error(`IndexedDB is required but not available for namespace "${namespace}"`)
  }
}

export class JsonPersister extends PersisterInterface {
  constructor(namespace, options = {}) {
    super(namespace)
    this.storeName = options.storeName || sanitizeStoreName(namespace)
    indexedDBService.registerInitialStore(this.storeName)
    const globalStrategy = indexedDBService.getFallbackStrategy?.() || ENV_FALLBACK
    this.fallbackStrategy = (options.fallbackStrategy || globalStrategy).toLowerCase()
    this.fallbackPersister = null
    this.initialized = false

    if (typeof indexedDB === 'undefined') {
      this.fallbackPersister = createFallbackPersister(this.namespace, this.fallbackStrategy)
    }
  }

  get supportsBinary() {
    return false
  }

  get supportsExport() {
    return !this.fallbackPersister
  }

  async _ensureReady() {
    if (this.fallbackPersister) {
      return false
    }
    if (this.initialized) {
      return true
    }

    try {
      await indexedDBService.initialize()
      if (!indexedDBService.hasStore(this.storeName)) {
        await indexedDBService.ensureStore(this.storeName)
      }
      this.initialized = true
      return true
    } catch (error) {
      console.error(`JsonPersister: Failed to initialize store "${this.storeName}"`, error)
      this.fallbackPersister = createFallbackPersister(this.namespace, this.fallbackStrategy)
      return false
    }
  }

  async save(key, data) {
    if (!key) {
      console.warn('JsonPersister: save() called without a key')
      return false
    }

    if (this.fallbackPersister) {
      return this.fallbackPersister.save(key, data)
    }

    await this._ensureReady()
    if (this.fallbackPersister) {
      return this.fallbackPersister.save(key, data)
    }

    try {
      const fullKey = this.getFullKey(key)
      const success = await indexedDBService.save(this.storeName, fullKey, data)
      return Boolean(success)
    } catch (error) {
      console.error(`JsonPersister: Failed to save "${key}"`, error)
      return false
    }
  }

  async load(key, defaultValue = null) {
    if (!key) {
      return defaultValue
    }

    if (this.fallbackPersister) {
      return this.fallbackPersister.load(key, defaultValue)
    }

    await this._ensureReady()
    if (this.fallbackPersister) {
      return this.fallbackPersister.load(key, defaultValue)
    }

    try {
      const fullKey = this.getFullKey(key)
      const data = await indexedDBService.load(this.storeName, fullKey, defaultValue)
      return data ?? defaultValue
    } catch (error) {
      console.error(`JsonPersister: Failed to load "${key}"`, error)
      return defaultValue
    }
  }

  async remove(key) {
    if (!key) {
      return false
    }

    if (this.fallbackPersister) {
      return this.fallbackPersister.remove(key)
    }

    await this._ensureReady()
    if (this.fallbackPersister) {
      return this.fallbackPersister.remove(key)
    }

    try {
      const fullKey = this.getFullKey(key)
      const success = await indexedDBService.delete(this.storeName, fullKey)
      return Boolean(success)
    } catch (error) {
      console.error(`JsonPersister: Failed to remove "${key}"`, error)
      return false
    }
  }

  async clear() {
    if (this.fallbackPersister) {
      return this.fallbackPersister.clear()
    }

    await this._ensureReady()
    if (this.fallbackPersister) {
      return this.fallbackPersister.clear()
    }

    try {
      const success = await indexedDBService.clear(this.storeName)
      return Boolean(success)
    } catch (error) {
      console.error(`JsonPersister: Failed to clear store "${this.storeName}"`, error)
      return false
    }
  }

  async exists(key) {
    if (!key) {
      return false
    }

    if (this.fallbackPersister) {
      return this.fallbackPersister.exists(key)
    }

    await this._ensureReady()
    if (this.fallbackPersister) {
      return this.fallbackPersister.exists(key)
    }

    try {
      const fullKey = this.getFullKey(key)
      const value = await indexedDBService.load(this.storeName, fullKey, null)
      return value !== null && value !== undefined
    } catch (error) {
      console.error(`JsonPersister: Failed to check existence for "${key}"`, error)
      return false
    }
  }

  async export() {
    if (!this.supportsExport) {
      console.warn(`JsonPersister: export() unavailable when fallback "${this.fallbackStrategy}" is active`)
      return null
    }

    await this._ensureReady()
    if (this.fallbackPersister) {
      return null
    }

    const entries = await indexedDBService.getAll(this.storeName)
    const prefix = `${this.namespace}-`
    return {
      format: EXPORT_FORMAT,
      version: 1,
      namespace: this.namespace,
      exportedAt: new Date().toISOString(),
      entries: entries.map(entry => ({
        key: entry.key.startsWith(prefix) ? entry.key.slice(prefix.length) : entry.key,
        data: entry.data,
        timestamp: entry.timestamp,
        version: entry.version
      }))
    }
  }

  async import(payload, options = {}) {
    if (!this.supportsExport) {
      console.warn(`JsonPersister: import() unavailable when fallback "${this.fallbackStrategy}" is active`)
      const entryCount = Array.isArray(payload?.entries) ? payload.entries.length : 0
      return { importedCount: 0, skippedCount: entryCount, mode: 'skip' }
    }

    if (!payload || typeof payload !== 'object') {
      return { importedCount: 0, skippedCount: 0, mode: 'skip' }
    }

    const entries = Array.isArray(payload.entries) ? payload.entries : []
    if (entries.length === 0) {
      return { importedCount: 0, skippedCount: 0, mode: 'skip' }
    }

    await this._ensureReady()
    if (this.fallbackPersister) {
      return { importedCount: 0, skippedCount: entries.length, mode: 'skip' }
    }

    const mode = options.mode === 'replace' ? 'replace' : 'merge'
    if (mode === 'replace') {
      await this.clear()
    }

    let importedCount = 0
    let skippedCount = 0
    for (const entry of entries) {
      const key = typeof entry?.key === 'string' ? entry.key.trim() : ''
      if (!key) {
        skippedCount += 1
        continue
      }
      try {
        await this.save(key, entry.data)
        importedCount += 1
      } catch (error) {
        skippedCount += 1
        console.warn(`JsonPersister: Failed to import entry "${key}"`, error)
      }
    }

    return { importedCount, skippedCount, mode }
  }
}
