import { eventBus } from '@/core/EventBusService.svelte.js'
import { createLogger } from '@/lib/logger.js'

const logger = createLogger('core/persistence/storage-persistence')

/**
 * Service de gestion de la persistance durable du stockage navigateur
 * 
 * Fonctionnalités :
 * - Demande de permission persistante via navigator.storage.persist()
 * - Vérification du statut actuel (persistent vs best-effort)
 * - Estimation du quota disponible
 * - Événements pour notifier les outils du statut
 * 
 * Contexte :
 * Par défaut, les navigateurs utilisent le mode "best-effort" pour IndexedDB/localStorage :
 * - Les données PEUVENT être supprimées silencieusement sous pression mémoire
 * - Pas de garantie de persistance à long terme
 * - Éviction automatique après quelques jours/semaines d'inactivité
 * 
 * Le mode "persistent" garantit que :
 * - Les données ne sont JAMAIS supprimées sans consentement utilisateur explicite
 * - Protection contre l'éviction automatique du navigateur
 * - Essentiel pour les applications critiques (IDE, éditeurs, gestionnaires de données)
 * 
 * Événements émis :
 * - 'storage:persistence-granted' : { persistent: true, quota }
 * - 'storage:persistence-denied' : { persistent: false, quota }
 * - 'storage:persistence-error' : { error }
 * 
 * @class StoragePersistenceService
 * 
 * @example
 * import { storagePersistenceService } from 'svelte-ide'
 * 
 * // Demander la persistance au démarrage
 * const granted = await storagePersistenceService.requestPersistence()
 * if (granted) {
 *   // ✅ Vos données sont protégées contre la suppression automatique
 * }
 * 
 * // Vérifier le statut
 * const isPersistent = await storagePersistenceService.isPersistent()
 * const quota = await storagePersistenceService.getQuotaInfo()
 */
export class StoragePersistenceService {
  constructor() {
    /** @type {boolean|null} Cache du statut de persistance */
    this._persistenceStatus = null
    
    /** @type {Object|null} Cache des informations de quota */
    this._quotaInfo = null
    
    /** @type {boolean} Flag pour éviter les requêtes multiples simultanées */
    this._requestInProgress = false
    
    /** @type {boolean} Logs de debug activés */
    this._debugMode = import.meta.env.DEV
  }

  /**
   * Vérifie si l'API Storage Persistence est disponible
   * @returns {boolean}
   */
  isSupported() {
    return typeof navigator !== 'undefined' && 
           navigator.storage && 
           typeof navigator.storage.persist === 'function'
  }

  /**
   * Vérifie si le stockage est actuellement persistant
   * @returns {Promise<boolean>}
   */
  async isPersistent() {
    if (!this.isSupported()) {
      if (this._debugMode) {
        logger.warn('StoragePersistenceService: Storage API not supported in this browser')
      }
      return false
    }

    try {
      // Utiliser le cache si disponible et récent
      if (this._persistenceStatus !== null) {
        return this._persistenceStatus
      }

      const persisted = await navigator.storage.persisted()
      this._persistenceStatus = persisted
      
      if (this._debugMode) {
        logger.log(`StoragePersistenceService: Current persistence status = ${persisted ? '✅ PERSISTENT' : '⚠️ BEST-EFFORT'}`)
      }
      
      return persisted
    } catch (error) {
      logger.error('StoragePersistenceService: Failed to check persistence status', error)
      eventBus.publish('storage:persistence-error', { error })
      return false
    }
  }

  /**
   * Demande la permission pour un stockage persistant
   * 
   * Note : Cette permission peut être accordée automatiquement ou nécessiter 
   * une interaction utilisateur selon le navigateur et les permissions du site.
   * 
   * Chrome : Accordé automatiquement si le site est dans les favoris ou visité fréquemment
   * Firefox : Demande une permission explicite
   * Safari : Toujours persistant (pas de mode best-effort)
   * 
   * @param {Object} options - Options de configuration
   * @param {boolean} [options.force=false] - Forcer une nouvelle requête même si déjà persistant
   * @param {boolean} [options.silent=false] - Ne pas publier d'événements
   * @returns {Promise<boolean>} true si la persistance est accordée
   */
  async requestPersistence(options = {}) {
    const { force = false, silent = false } = options

    if (!this.isSupported()) {
      if (this._debugMode) {
        logger.warn('StoragePersistenceService: Cannot request persistence - API not supported')
      }
      return false
    }

    // Éviter les requêtes multiples simultanées
    if (this._requestInProgress) {
      if (this._debugMode) {
        logger.log('StoragePersistenceService: Request already in progress, waiting...')
      }
      // Attendre que la requête en cours se termine
      while (this._requestInProgress) {
        await new Promise(resolve => setTimeout(resolve, 100))
      }
      return this._persistenceStatus || false
    }

    // Vérifier si déjà persistant (sauf si force=true)
    if (!force) {
      const alreadyPersistent = await this.isPersistent()
      if (alreadyPersistent) {
        if (this._debugMode) {
          logger.log('StoragePersistenceService: Storage is already persistent')
        }
        return true
      }
    }

    this._requestInProgress = true

    try {
      if (this._debugMode) {
        logger.log('StoragePersistenceService: Requesting persistent storage...')
      }

      const granted = await navigator.storage.persist()
      this._persistenceStatus = granted

      if (this._debugMode) {
        if (granted) {
          logger.log('✅ StoragePersistenceService: Persistent storage GRANTED - Data protected from automatic eviction')
        } else {
          logger.warn('⚠️ StoragePersistenceService: Persistent storage DENIED - Data may be evicted under storage pressure')
        }
      }

      // Récupérer les informations de quota
      const quotaInfo = await this.getQuotaInfo()

      // Publier événement
      if (!silent) {
        if (granted) {
          eventBus.publish('storage:persistence-granted', { 
            persistent: true, 
            quota: quotaInfo 
          })
        } else {
          eventBus.publish('storage:persistence-denied', { 
            persistent: false, 
            quota: quotaInfo 
          })
        }
      }

      return granted
    } catch (error) {
      logger.error('StoragePersistenceService: Failed to request persistence', error)
      this._persistenceStatus = false
      
      if (!silent) {
        eventBus.publish('storage:persistence-error', { error })
      }
      
      return false
    } finally {
      this._requestInProgress = false
    }
  }

  /**
   * Récupère les informations de quota et d'utilisation du stockage
   * 
   * @returns {Promise<Object>} Informations de quota
   * @returns {number} return.quota - Quota total disponible (en octets)
   * @returns {number} return.usage - Espace utilisé (en octets)
   * @returns {number} return.available - Espace restant (en octets)
   * @returns {number} return.percentUsed - Pourcentage utilisé (0-100)
   * @returns {string} return.quotaFormatted - Quota formaté (ex: "10 GB")
   * @returns {string} return.usageFormatted - Usage formaté (ex: "250 MB")
   */
  async getQuotaInfo() {
    if (!this.isSupported() || typeof navigator.storage.estimate !== 'function') {
      return {
        quota: 0,
        usage: 0,
        available: 0,
        percentUsed: 0,
        quotaFormatted: 'N/A',
        usageFormatted: 'N/A'
      }
    }

    try {
      // Utiliser le cache si disponible et récent (< 30 secondes)
      if (this._quotaInfo && (Date.now() - this._quotaInfo.timestamp < 30000)) {
        return this._quotaInfo.data
      }

      const estimate = await navigator.storage.estimate()
      const quota = estimate.quota || 0
      const usage = estimate.usage || 0
      const available = quota - usage
      const percentUsed = quota > 0 ? (usage / quota) * 100 : 0

      const info = {
        quota,
        usage,
        available,
        percentUsed,
        quotaFormatted: this._formatBytes(quota),
        usageFormatted: this._formatBytes(usage),
        availableFormatted: this._formatBytes(available)
      }

      // Mettre en cache
      this._quotaInfo = {
        timestamp: Date.now(),
        data: info
      }

      if (this._debugMode) {
        logger.log('StoragePersistenceService: Quota info', {
          usage: info.usageFormatted,
          quota: info.quotaFormatted,
          percentUsed: `${percentUsed.toFixed(1)}%`
        })
      }

      return info
    } catch (error) {
      logger.error('StoragePersistenceService: Failed to get quota info', error)
      return {
        quota: 0,
        usage: 0,
        available: 0,
        percentUsed: 0,
        quotaFormatted: 'Error',
        usageFormatted: 'Error'
      }
    }
  }

  /**
   * Vérifie si le quota est proche de la limite (>80% par défaut)
   * @param {number} [threshold=80] - Seuil en pourcentage (0-100)
   * @returns {Promise<boolean>}
   */
  async isQuotaNearLimit(threshold = 80) {
    const info = await this.getQuotaInfo()
    return info.percentUsed >= threshold
  }

  /**
   * Invalide le cache (force une nouvelle vérification au prochain appel)
   */
  invalidateCache() {
    this._persistenceStatus = null
    this._quotaInfo = null
    if (this._debugMode) {
      logger.log('StoragePersistenceService: Cache invalidated')
    }
  }

  /**
   * Active ou désactive le mode debug
   * @param {boolean} enabled
   */
  setDebugMode(enabled) {
    this._debugMode = Boolean(enabled)
  }

  /**
   * Formate un nombre d'octets en chaîne lisible
   * @private
   * @param {number} bytes
   * @returns {string}
   */
  _formatBytes(bytes) {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`
  }
}

// Singleton
let _storagePersistenceService = null

export function getStoragePersistenceService() {
  if (!_storagePersistenceService) {
    _storagePersistenceService = new StoragePersistenceService()
  }
  return _storagePersistenceService
}

// Export direct pour usage simplifié
export const storagePersistenceService = getStoragePersistenceService()
