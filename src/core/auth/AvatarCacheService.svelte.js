/**
 * Service de cache pour les avatars utilisateurs
 * 
 * Stocke les photos de profil dans IndexedDB pour éviter de les re-télécharger
 * à chaque refresh token ou reload de la page.
 * 
 * Stratégie :
 * - Cache par userId (sub) pour isolation multi-utilisateurs
 * - Stockage du Blob original (MIME type préservé)
 * - TTL de 24h (avatar peut changer, mais rarement)
 * - Nettoyage automatique au logout
 */

import { authDebug, authWarn } from '@/core/auth/authLogging.svelte.js'

const STORE_NAME = 'user-avatars'
const DB_NAME = 'svelte-ide-auth'
const DB_VERSION = 1
const CACHE_TTL_MS = 24 * 60 * 60 * 1000 // 24 heures

class AvatarCacheService {
  constructor() {
    this.db = null
    this.ready = this.initDB()
  }

  /**
   * Initialise la base IndexedDB pour le cache d'avatars
   * @private
   */
  async initDB() {
    if (typeof indexedDB === 'undefined') {
      authWarn('IndexedDB not available, avatar cache disabled')
      return
    }

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION)

      request.onerror = () => {
        authWarn('Failed to open avatar cache database', request.error)
        reject(request.error)
      }

      request.onsuccess = () => {
        this.db = request.result
        authDebug('Avatar cache database initialized')
        resolve()
      }

      request.onupgradeneeded = (event) => {
        const db = event.target.result

        // Créer le store si nécessaire
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'userId' })
          store.createIndex('timestamp', 'timestamp', { unique: false })
          authDebug('Avatar cache store created')
        }
      }
    })
  }

  /**
   * Sauvegarde un avatar dans le cache
   * @param {string} userId - Identifiant unique de l'utilisateur (sub)
   * @param {Blob} blob - Image de profil (Blob)
   * @returns {Promise<string>} URL blob pour affichage immédiat
   */
  async saveAvatar(userId, blob) {
    if (!userId || !blob) {
      authWarn('Invalid parameters for avatar cache', { userId: !!userId, blob: !!blob })
      return null
    }

    await this.ready

    if (!this.db) {
      authWarn('Avatar cache not available, returning blob URL only')
      return URL.createObjectURL(blob)
    }

    try {
      const transaction = this.db.transaction([STORE_NAME], 'readwrite')
      const store = transaction.objectStore(STORE_NAME)

      const record = {
        userId: userId,
        blob: blob,
        mimeType: blob.type || 'image/jpeg',
        size: blob.size,
        timestamp: Date.now()
      }

      await new Promise((resolve, reject) => {
        const request = store.put(record)
        request.onsuccess = () => resolve()
        request.onerror = () => reject(request.error)
      })

      authDebug('Avatar cached successfully', {
        userId: userId.substring(0, 8) + '...',
        size: blob.size,
        mimeType: blob.type
      })

      // Retourner l'URL blob pour affichage immédiat
      return URL.createObjectURL(blob)
    } catch (error) {
      authWarn('Failed to cache avatar', error)
      // Fallback: retourner quand même l'URL blob (pas de cache mais image visible)
      return URL.createObjectURL(blob)
    }
  }

  /**
   * Récupère un avatar depuis le cache
   * @param {string} userId - Identifiant unique de l'utilisateur (sub)
   * @returns {Promise<string|null>} URL blob de l'avatar ou null si absent/expiré
   */
  async getAvatar(userId) {
    if (!userId) {
      return null
    }

    await this.ready

    if (!this.db) {
      return null
    }

    try {
      const transaction = this.db.transaction([STORE_NAME], 'readonly')
      const store = transaction.objectStore(STORE_NAME)

      const record = await new Promise((resolve, reject) => {
        const request = store.get(userId)
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
      })

      if (!record) {
        authDebug('Avatar not found in cache', { userId: userId.substring(0, 8) + '...' })
        return null
      }

      // Vérifier TTL
      const age = Date.now() - record.timestamp
      if (age > CACHE_TTL_MS) {
        authDebug('Avatar cache expired', {
          userId: userId.substring(0, 8) + '...',
          ageHours: Math.round(age / (60 * 60 * 1000))
        })
        // Supprimer l'entrée expirée
        await this.deleteAvatar(userId)
        return null
      }

      authDebug('Avatar restored from cache', {
        userId: userId.substring(0, 8) + '...',
        size: record.size,
        ageMinutes: Math.round(age / (60 * 1000))
      })

      // Créer un nouveau blob URL depuis le blob stocké
      return URL.createObjectURL(record.blob)
    } catch (error) {
      authWarn('Failed to retrieve avatar from cache', error)
      return null
    }
  }

  /**
   * Supprime un avatar du cache
   * @param {string} userId - Identifiant unique de l'utilisateur
   */
  async deleteAvatar(userId) {
    if (!userId) {
      return
    }

    await this.ready

    if (!this.db) {
      return
    }

    try {
      const transaction = this.db.transaction([STORE_NAME], 'readwrite')
      const store = transaction.objectStore(STORE_NAME)

      await new Promise((resolve, reject) => {
        const request = store.delete(userId)
        request.onsuccess = () => resolve()
        request.onerror = () => reject(request.error)
      })

      authDebug('Avatar removed from cache', { userId: userId.substring(0, 8) + '...' })
    } catch (error) {
      authWarn('Failed to delete avatar from cache', error)
    }
  }

  /**
   * Nettoie tous les avatars expirés
   * @returns {Promise<number>} Nombre d'avatars supprimés
   */
  async cleanExpired() {
    await this.ready

    if (!this.db) {
      return 0
    }

    try {
      const transaction = this.db.transaction([STORE_NAME], 'readwrite')
      const store = transaction.objectStore(STORE_NAME)

      const allRecords = await new Promise((resolve, reject) => {
        const request = store.getAll()
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
      })

      let deletedCount = 0
      const now = Date.now()

      for (const record of allRecords) {
        if (now - record.timestamp > CACHE_TTL_MS) {
          await this.deleteAvatar(record.userId)
          deletedCount++
        }
      }

      if (deletedCount > 0) {
        authDebug('Cleaned expired avatars', { count: deletedCount })
      }

      return deletedCount
    } catch (error) {
      authWarn('Failed to clean expired avatars', error)
      return 0
    }
  }

  /**
   * Vide complètement le cache d'avatars
   */
  async clearAll() {
    await this.ready

    if (!this.db) {
      return
    }

    try {
      const transaction = this.db.transaction([STORE_NAME], 'readwrite')
      const store = transaction.objectStore(STORE_NAME)

      await new Promise((resolve, reject) => {
        const request = store.clear()
        request.onsuccess = () => resolve()
        request.onerror = () => reject(request.error)
      })

      authDebug('Avatar cache cleared')
    } catch (error) {
      authWarn('Failed to clear avatar cache', error)
    }
  }
}

// Singleton exporté
export const avatarCacheService = new AvatarCacheService()
