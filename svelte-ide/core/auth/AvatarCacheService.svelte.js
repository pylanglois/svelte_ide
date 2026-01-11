

import { createLogger } from '../../lib/logger.js'

const logger = createLogger('core/auth/avatar-cache')

const STORE_NAME = 'user-avatars'
const DB_NAME = 'svelte-ide-auth'
const DB_VERSION = 1
const CACHE_TTL_MS = 24 * 60 * 60 * 1000 

class AvatarCacheService {
  constructor() {
    this.db = null
    this.ready = this.initDB()
  }

  
  async initDB() {
    if (typeof indexedDB === 'undefined') {
    logger.warn('IndexedDB not available, avatar cache disabled')
      return
    }

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION)

      request.onerror = () => {
        logger.warn('Failed to open avatar cache database', request.error)
        reject(request.error)
      }

      request.onsuccess = () => {
        this.db = request.result
        logger.debug('Avatar cache database initialized')
        resolve()
      }

      request.onupgradeneeded = (event) => {
        const db = event.target.result

        
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'userId' })
          store.createIndex('timestamp', 'timestamp', { unique: false })
          logger.debug('Avatar cache store created')
        }
      }
    })
  }

  
  async saveAvatar(userId, blob) {
    if (!userId || !blob) {
      logger.warn('Invalid parameters for avatar cache', { userId: !!userId, blob: !!blob })
      return null
    }

    await this.ready

    if (!this.db) {
      logger.warn('Avatar cache not available, returning blob URL only')
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

      logger.debug('Avatar cached successfully', {
        userId: userId.substring(0, 8) + '...',
        size: blob.size,
        mimeType: blob.type
      })

      
      return URL.createObjectURL(blob)
    } catch (error) {
      logger.warn('Failed to cache avatar', error)
      
      return URL.createObjectURL(blob)
    }
  }

  
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
        logger.debug('Avatar not found in cache', { userId: userId.substring(0, 8) + '...' })
        return null
      }

      
      const age = Date.now() - record.timestamp
      if (age > CACHE_TTL_MS) {
        logger.debug('Avatar cache expired', {
          userId: userId.substring(0, 8) + '...',
          ageHours: Math.round(age / (60 * 60 * 1000))
        })
        
        await this.deleteAvatar(userId)
        return null
      }

      logger.debug('Avatar restored from cache', {
        userId: userId.substring(0, 8) + '...',
        size: record.size,
        ageMinutes: Math.round(age / (60 * 1000))
      })

      
      return URL.createObjectURL(record.blob)
    } catch (error) {
      logger.warn('Failed to retrieve avatar from cache', error)
      return null
    }
  }

  
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

      logger.debug('Avatar removed from cache', { userId: userId.substring(0, 8) + '...' })
    } catch (error) {
      logger.warn('Failed to delete avatar from cache', error)
    }
  }

  
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
        logger.debug('Cleaned expired avatars', { count: deletedCount })
      }

      return deletedCount
    } catch (error) {
      logger.warn('Failed to clean expired avatars', error)
      return 0
    }
  }

  
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

      logger.debug('Avatar cache cleared')
    } catch (error) {
      logger.warn('Failed to clear avatar cache', error)
    }
  }
}


export const avatarCacheService = new AvatarCacheService()
