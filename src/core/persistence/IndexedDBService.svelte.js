import { namespacedKey } from '@/core/config/appKey.js'
import { TokenCipher } from '@/core/security/tokenCipher.svelte.js'
import { eventBus } from '@/core/EventBusService.svelte.js'

const DB_NAME = namespacedKey('app-data')
const FALLBACK_STRATEGIES = ['block', 'localstorage', 'memory']
const DEFAULT_FALLBACK_STRATEGY = (import.meta.env.VITE_INDEXEDDB_FALLBACK_STRATEGY || 'block').toLowerCase()

/**
 * Service de persistance IndexedDB avec chiffrement transparent
 * 
 * Fonctionnalités :
 * - Stockage key-value dans des stores dynamiques
 * - Chiffrement/déchiffrement automatique via TokenCipher
 * - Gestion des migrations de schéma
 * - Stratégie de fallback configurable
 * - API simple et transparente pour les outils externes
 * 
 * Architecture :
 * - Utilise IndexedDB pour stockage persistant (quota ~50% disque)
 * - Clé de chiffrement fournie par authStore (dérivée de userInfo)
 * - Format : { key, value (chiffré), timestamp, version }
 * - Fallback vers localStorage ou memory selon configuration
 */
export class IndexedDBService {
  constructor() {
    this.db = null
    this.dbReady = null
    this.cipher = null
    this.encryptionKey = null
    this.dbVersion = null
    this.availableStores = new Set()
    this.fallbackStrategy = null
    this.fallbackPersister = null
    this.fallbackStrategy = FALLBACK_STRATEGIES.includes(DEFAULT_FALLBACK_STRATEGY)
      ? DEFAULT_FALLBACK_STRATEGY
      : 'block'
    this.encryptionReady = false
    this._encryptionReadyPromise = null
    this._resolveEncryptionReady = null
    this._rejectEncryptionReady = null
    this._encryptionReadyWaiters = 0
    this.initialStores = new Set()
    this.registerInitialStore('default')
    this.registerInitialStore('tools')
    this.registerInitialStore('layout')
    this.registerInitialStore('preferences')
    this._createEncryptionReadyPromise()
  }

  async _ensureDatabaseReady(storeNames) {
    if (!this.dbReady) {
      await this.initialize(storeNames)
    } else {
      await this.dbReady
    }

    if (!this.db) {
      this.dbReady = null
      await this.initialize(storeNames)
    }
  }

  /**
   * Initialise la base de données IndexedDB
   * @param {string[]} storeNames - Liste des stores à créer
   * @returns {Promise<IDBDatabase>}
   */
  registerInitialStore(storeName) {
    if (!storeName || typeof storeName !== 'string') {
      return
    }
    const normalized = storeName.trim()
    if (!normalized) {
      return
    }
    this.initialStores.add(normalized)
  }

  async initialize(storeNames = []) {
    const stores = Array.isArray(storeNames) ? storeNames : [storeNames]
    for (const storeName of stores) {
      this.registerInitialStore(storeName)
    }
    const storesToCreate = Array.from(this.initialStores)

    if (this.dbReady) {
      return this.dbReady
    }

    this.dbReady = new Promise((resolve, reject) => {
      // Vérifier disponibilité IndexedDB
      if (typeof indexedDB === 'undefined') {
        reject(new Error('IndexedDB not available in this environment'))
        return
      }

      let request
      try {
        request = indexedDB.open(DB_NAME)
      } catch (error) {
        reject(error)
        return
      }

      request.onerror = () => {
        console.error('IndexedDBService: Failed to open database', request.error)
        reject(request.error)
      }

      request.onsuccess = () => {
        this.db = request.result
        this.dbVersion = this.db?.version ?? null

        this.db.addEventListener('versionchange', () => {
          console.warn('IndexedDBService: Database version change detected, closing connection')
          this.close()
        })

        console.debug('IndexedDBService: Database opened successfully')
        resolve(this.db)
      }

      request.onupgradeneeded = (event) => {
        const db = event.target.result
        this.dbVersion = db?.version ?? null
        
        console.debug('IndexedDBService: Upgrading database schema', {
          oldVersion: event.oldVersion,
          newVersion: event.newVersion
        })

        // Créer les stores demandés
        for (const storeName of storesToCreate) {
          if (!db.objectStoreNames.contains(storeName)) {
            const objectStore = db.createObjectStore(storeName, { keyPath: 'key' })
            
            // Index optionnels pour requêtes
            objectStore.createIndex('timestamp', 'timestamp', { unique: false })
            objectStore.createIndex('version', 'version', { unique: false })
            
            this.availableStores.add(storeName)
            console.debug(`IndexedDBService: Created object store "${storeName}"`)
          }
        }
      }
    })

    return this.dbReady
  }

  /**
   * Définit la stratégie de fallback globale utilisée par IndexedDBPersister
   * @param {'block'|'localStorage'|'memory'|'user-choice'} strategy
   */
  setFallbackStrategy(strategy) {
    if (!strategy || typeof strategy !== 'string') {
      console.warn('IndexedDBService: invalid fallback strategy type')
      return
    }
    const normalized = strategy.toLowerCase()
    if (!FALLBACK_STRATEGIES.includes(normalized)) {
      console.warn('IndexedDBService: unknown fallback strategy', { strategy })
      return
    }
    this.fallbackStrategy = normalized
    console.info('IndexedDBService: fallback strategy set', { strategy: normalized })
  }

  /**
   * Retourne la stratégie de fallback actuellement configurée
   * @returns {string}
   */
  getFallbackStrategy() {
    return this.fallbackStrategy || 'block'
  }

  /**
   * Crée un nouveau store dynamiquement (nécessite migration de version)
   * @param {string} storeName - Nom du store à créer
   * @returns {Promise<boolean>} true si créé ou déjà existant
   */
  async ensureStore(storeName) {
    this.registerInitialStore(storeName)
    if (!this.dbReady) {
      return true
    }
    await this._ensureDatabaseReady()
    if (this.hasStore(storeName)) {
      return true
    }

    // Fermer la connexion actuelle
    if (this.db) {
      this.db.close()
    }

    // Ouvrir avec version incrémentée pour déclencher onupgradeneeded
    const currentVersion = this.dbVersion || this.db?.version || 1
    const newVersion = currentVersion + 1

    console.debug(`IndexedDBService: Creating store "${storeName}" (version ${newVersion})`)

    this.dbReady = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, newVersion)

      request.onerror = () => {
        console.error(`IndexedDBService: Failed to create store "${storeName}"`, request.error)
        reject(request.error)
      }

      request.onsuccess = () => {
        this.db = request.result
        this.dbVersion = this.db?.version ?? null
        this.availableStores.add(storeName)
        console.debug(`IndexedDBService: Store "${storeName}" created successfully`)
        resolve(this.db)
      }

      request.onupgradeneeded = (event) => {
        const db = event.target.result
        this.dbVersion = db?.version ?? null

        if (!db.objectStoreNames.contains(storeName)) {
          const objectStore = db.createObjectStore(storeName, { keyPath: 'key' })
          objectStore.createIndex('timestamp', 'timestamp', { unique: false })
          objectStore.createIndex('version', 'version', { unique: false })
          console.debug(`IndexedDBService: Object store "${storeName}" created in upgrade`)
        }
      }
    })

    await this.dbReady
    return true
  }

  /**
   * Définit la clé de chiffrement (appelée par authStore après login)
   * @param {string} key - Clé de chiffrement en base64
   */
  setEncryptionKey(key) {
    if (!key || typeof key !== 'string') {
      console.warn('IndexedDBService: Invalid encryption key provided')
      return
    }

    this.encryptionKey = key
    this.cipher = new TokenCipher(key)
    this.encryptionReady = true
    if (this._resolveEncryptionReady) {
      this._resolveEncryptionReady({
        encrypted: this.cipher?.enabled ?? false,
        timestamp: Date.now()
      })
      this._resolveEncryptionReady = null
      this._rejectEncryptionReady = null
    }
    
    console.debug('IndexedDBService: Encryption key set', {
      keyLength: key.length,
      cipherEnabled: this.cipher.enabled
    })
  }

  /**
   * Efface la clé de chiffrement (appelée lors du logout)
   */
  clearEncryptionKey() {
    this.encryptionKey = null
    this.cipher = null
    this.encryptionReady = false
    this._resetEncryptionReadyPromise('Encryption key cleared')
    console.debug('IndexedDBService: Encryption key cleared')
  }

  _createEncryptionReadyPromise() {
    this.encryptionReady = false
    this._encryptionReadyPromise = new Promise((resolve, reject) => {
      this._resolveEncryptionReady = resolve
      this._rejectEncryptionReady = reject
    })
  }

  _resetEncryptionReadyPromise(reason) {
    if (this._rejectEncryptionReady && this._encryptionReadyWaiters > 0) {
      this._rejectEncryptionReady(new Error(reason || 'Encryption readiness reset'))
    }
    this._resolveEncryptionReady = null
    this._rejectEncryptionReady = null
    this._createEncryptionReadyPromise()
  }

  _trackReadyWaiter() {
    this._encryptionReadyWaiters += 1
    let released = false
    return () => {
      if (released) {
        return
      }
      released = true
      this._encryptionReadyWaiters = Math.max(0, this._encryptionReadyWaiters - 1)
    }
  }

  readyForEncryption(options = {}) {
    const { timeoutMs = 0, emitErrorEvent = true } = options ?? {}
    if (this.encryptionReady) {
      return Promise.resolve({
        encrypted: true,
        timestamp: Date.now()
      })
    }

    const basePromise = this._encryptionReadyPromise
    const releaseWaiter = this._trackReadyWaiter()
    if (!timeoutMs || timeoutMs <= 0) {
      return basePromise.finally(releaseWaiter)
    }

    return new Promise((resolve, reject) => {
      let timeoutId = null
      const cleanup = () => {
        if (timeoutId !== null) {
          clearTimeout(timeoutId)
          timeoutId = null
        }
      }

      basePromise
        .then((payload) => {
          cleanup()
          releaseWaiter()
          resolve(payload)
        })
        .catch((error) => {
          cleanup()
          releaseWaiter()
          reject(error)
        })

      timeoutId = setTimeout(() => {
        const error = new Error(`IndexedDBService: Encryption key not available after ${timeoutMs}ms`)
        if (emitErrorEvent) {
          eventBus.publish('persistence:error', {
            reason: 'timeout',
            timeoutMs,
            timestamp: Date.now()
          })
        }
        releaseWaiter()
        reject(error)
      }, timeoutMs)
    })
  }

  _shouldRetryDatabaseOperation(error) {
    if (!error) {
      return false
    }
    const message = (error.message || '').toLowerCase()
    return error.name === 'InvalidStateError' ||
      error.name === 'TransactionInactiveError' ||
      message.includes('closed database')
  }

  /**
   * Vérifie qu'un store existe dans la base
   * @param {string} storeName
   * @returns {boolean}
   */
  hasStore(storeName) {
    if (!this.db) {
      return false
    }
    return this.db.objectStoreNames.contains(storeName)
  }

  /**
   * Sauvegarde une donnée dans IndexedDB (chiffrée si clé disponible)
   * @param {string} storeName - Nom du store
   * @param {string} key - Clé unique
   * @param {any} data - Données à sauvegarder (sérialisables en JSON)
   * @returns {Promise<boolean>} true si succès
   */
  async save(storeName, key, data, retryAttempted = false) {
    try {
      await this._ensureDatabaseReady()

      // Créer le store s'il n'existe pas
      if (!this.hasStore(storeName)) {
        console.debug(`IndexedDBService: Store "${storeName}" does not exist, creating it...`)
        await this.ensureStore(storeName)
      }

      // Sérialiser les données
      const serialized = JSON.stringify(data)

      // Chiffrer si clé disponible
      let value = serialized
      if (this.cipher && this.cipher.enabled) {
        value = await this.cipher.encrypt(serialized)
      }

      // Préparer l'entrée
      const entry = {
        key,
        value,
        timestamp: Date.now(),
        version: 1
      }

      // Transaction d'écriture
      const transaction = this.db.transaction([storeName], 'readwrite')
      const objectStore = transaction.objectStore(storeName)
      const request = objectStore.put(entry)

      return new Promise((resolve, reject) => {
        request.onsuccess = () => {
          console.debug(`IndexedDBService: Saved "${key}" in "${storeName}"`)
          resolve(true)
        }

        request.onerror = () => {
          console.error(`IndexedDBService: Failed to save "${key}"`, request.error)
          reject(request.error)
        }
      })
    } catch (error) {
      if (!retryAttempted && this._shouldRetryDatabaseOperation(error)) {
        console.warn('IndexedDBService: Save failed due to closed database, retrying once', error)
        await this.initialize()
        return this.save(storeName, key, data, true)
      }
      console.error('IndexedDBService: Save error', error)
      return false
    }
  }

  /**
   * Charge une donnée depuis IndexedDB (déchiffrée automatiquement)
   * @param {string} storeName - Nom du store
   * @param {string} key - Clé unique
   * @param {any} defaultValue - Valeur par défaut si clé inexistante
   * @returns {Promise<any>} Données déchiffrées ou defaultValue
   */
  async load(storeName, key, defaultValue = null) {
    try {
      await this._ensureDatabaseReady()

      // Créer le store s'il n'existe pas
      if (!this.hasStore(storeName)) {
        console.debug(`IndexedDBService: Store "${storeName}" does not exist, creating it...`)
        await this.ensureStore(storeName)
        return defaultValue // Store vide, retourner valeur par défaut
      }

      const transaction = this.db.transaction([storeName], 'readonly')
      const objectStore = transaction.objectStore(storeName)
      const request = objectStore.get(key)

      return new Promise((resolve, reject) => {
        request.onsuccess = async () => {
          const entry = request.result

          if (!entry) {
            resolve(defaultValue)
            return
          }

          try {
            // Déchiffrer si clé disponible
            let serialized = entry.value
            if (this.cipher && this.cipher.enabled) {
              serialized = await this.cipher.decrypt(entry.value)
              
              if (serialized === null) {
                console.warn(`IndexedDBService: Failed to decrypt "${key}", returning default`)
                resolve(defaultValue)
                return
              }
            }

            // Désérialiser
            const data = JSON.parse(serialized)
            console.debug(`IndexedDBService: Loaded "${key}" from "${storeName}"`)
            resolve(data)
          } catch (error) {
            console.error(`IndexedDBService: Failed to parse data for "${key}"`, error)
            resolve(defaultValue)
          }
        }

        request.onerror = () => {
          console.error(`IndexedDBService: Failed to load "${key}"`, request.error)
          resolve(defaultValue)
        }
      })
    } catch (error) {
      console.error('IndexedDBService: Load error', error)
      return defaultValue
    }
  }

  /**
   * Supprime une entrée
   * @param {string} storeName
   * @param {string} key
   * @returns {Promise<boolean>}
   */
  async delete(storeName, key) {
    try {
      await this._ensureDatabaseReady()

      if (!this.hasStore(storeName)) {
        return false
      }

      const transaction = this.db.transaction([storeName], 'readwrite')
      const objectStore = transaction.objectStore(storeName)
      const request = objectStore.delete(key)

      return new Promise((resolve, reject) => {
        request.onsuccess = () => {
          console.debug(`IndexedDBService: Deleted "${key}" from "${storeName}"`)
          resolve(true)
        }

        request.onerror = () => {
          console.error(`IndexedDBService: Failed to delete "${key}"`, request.error)
          reject(request.error)
        }
      })
    } catch (error) {
      console.error('IndexedDBService: Delete error', error)
      return false
    }
  }

  /**
   * Efface toutes les entrées d'un store
   * @param {string} storeName
   * @returns {Promise<boolean>}
   */
  async clear(storeName) {
    try {
      await this._ensureDatabaseReady()

      if (!this.hasStore(storeName)) {
        return false
      }

      const transaction = this.db.transaction([storeName], 'readwrite')
      const objectStore = transaction.objectStore(storeName)
      const request = objectStore.clear()

      return new Promise((resolve, reject) => {
        request.onsuccess = () => {
          console.debug(`IndexedDBService: Cleared store "${storeName}"`)
          resolve(true)
        }

        request.onerror = () => {
          console.error(`IndexedDBService: Failed to clear "${storeName}"`, request.error)
          reject(request.error)
        }
      })
    } catch (error) {
      console.error('IndexedDBService: Clear error', error)
      return false
    }
  }

  /**
   * Compte le nombre d'entrées dans un store
   * @param {string} storeName
   * @returns {Promise<number>}
   */
  async count(storeName) {
    try {
      await this._ensureDatabaseReady()

      if (!this.hasStore(storeName)) {
        return 0
      }

      const transaction = this.db.transaction([storeName], 'readonly')
      const objectStore = transaction.objectStore(storeName)
      const request = objectStore.count()

      return new Promise((resolve, reject) => {
        request.onsuccess = () => {
          resolve(request.result)
        }

        request.onerror = () => {
          console.error(`IndexedDBService: Failed to count "${storeName}"`, request.error)
          resolve(0)
        }
      })
    } catch (error) {
      console.error('IndexedDBService: Count error', error)
      return 0
    }
  }

  /**
   * Récupère toutes les entrées d'un store (déchiffrées)
   * @param {string} storeName
   * @param {number} limit - Nombre max d'entrées (0 = toutes)
   * @returns {Promise<Array>}
   */
  async getAll(storeName, limit = 0) {
    try {
      await this._ensureDatabaseReady()

      if (!this.hasStore(storeName)) {
        return []
      }

      const transaction = this.db.transaction([storeName], 'readonly')
      const objectStore = transaction.objectStore(storeName)
      const request = limit > 0 ? objectStore.getAll(undefined, limit) : objectStore.getAll()

      return new Promise((resolve, reject) => {
        request.onsuccess = async () => {
          const entries = request.result

          // Déchiffrer toutes les entrées
          const decrypted = []
          for (const entry of entries) {
            try {
              let serialized = entry.value
              if (this.cipher && this.cipher.enabled) {
                serialized = await this.cipher.decrypt(entry.value)
                if (serialized === null) continue
              }

              const data = JSON.parse(serialized)
              decrypted.push({
                key: entry.key,
                data,
                timestamp: entry.timestamp,
                version: entry.version
              })
            } catch (error) {
              console.warn(`IndexedDBService: Failed to decrypt entry "${entry.key}"`, error)
            }
          }

          resolve(decrypted)
        }

        request.onerror = () => {
          console.error(`IndexedDBService: Failed to getAll from "${storeName}"`, request.error)
          resolve([])
        }
      })
    } catch (error) {
      console.error('IndexedDBService: GetAll error', error)
      return []
    }
  }

  /**
   * Ferme la connexion à la base de données
   */
  close() {
    if (this.db) {
      this.db.close()
      this.db = null
      this.dbReady = null
      console.debug('IndexedDBService: Database closed')
    }
  }
}

// Singleton
let _indexedDBService = null

export function getIndexedDBService() {
  if (!_indexedDBService) {
    _indexedDBService = new IndexedDBService()
  }
  return _indexedDBService
}

// Export direct pour usage simplifié
export const indexedDBService = getIndexedDBService()
