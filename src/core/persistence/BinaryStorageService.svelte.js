import { namespacedKey } from '@/core/config/appKey.js'
import { TokenCipher } from '@/core/security/tokenCipher.svelte.js'
import { createLogger } from '@/lib/logger.js'
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate'

const logger = createLogger('core/persistence/binary-storage')

const DB_NAME = namespacedKey('binary-storage')
const METADATA_STORE = 'binary_metadata'
const PAYLOAD_STORE = 'binary_payloads'
const DEFAULT_TENANT = 'default'
const EXPORT_MANIFEST = 'manifest.json'
const ZIP_FOLDER = 'blobs'
const DEFAULT_MIME = 'application/octet-stream'
const MAX_TAGS = 32

const textEncoder = typeof TextEncoder !== 'undefined' ? new TextEncoder() : null
const hasStructuredClone = typeof structuredClone === 'function'

function sanitizeNamespace(namespace) {
  if (!namespace || typeof namespace !== 'string') {
    throw new Error('BinaryStorageService: namespace is required')
  }
  const trimmed = namespace.trim()
  if (!trimmed) {
    throw new Error('BinaryStorageService: namespace must be a non-empty string')
  }
  return trimmed
}

function sanitizeBlobId(blobId) {
  if (!blobId || typeof blobId !== 'string') {
    throw new Error('BinaryStorageService: blobId is required')
  }
  const trimmed = blobId.trim()
  if (!trimmed) {
    throw new Error('BinaryStorageService: blobId must be a non-empty string')
  }
  return trimmed
}

function normalizeTenantId(tenantId) {
  if (!tenantId) {
    return DEFAULT_TENANT
  }
  return tenantId.toString().trim().toLowerCase() || DEFAULT_TENANT
}

function buildCompositeKey(tenantKey, namespace, blobId) {
  return `${tenantKey}::${namespace}::${blobId}`
}

function buildTenantNamespaceKey(tenantKey, namespace) {
  return `${tenantKey}::${namespace}`
}

function sanitizeFilename(name, fallback) {
  const base = (name || fallback || 'blob').toString().replace(/[/\\]+/g, '_').trim()
  const sanitized = base.replace(/[^\w.\-]+/g, '_')
  return sanitized || fallback || 'blob'
}

async function toBinaryBuffer(input) {
  if (input instanceof Blob) {
    return await input.arrayBuffer()
  }
  if (input instanceof ArrayBuffer) {
    return input
  }
  if (ArrayBuffer.isView(input)) {
    return input.buffer.slice(input.byteOffset, input.byteOffset + input.byteLength)
  }
  if (typeof input === 'string') {
    if (!textEncoder) {
      throw new Error('BinaryStorageService: TextEncoder not available to convert string payloads')
    }
    return textEncoder.encode(input).buffer
  }
  throw new Error('BinaryStorageService: Unsupported binary payload type')
}

function uint8ToBlob(uint8Array, mimeType = DEFAULT_MIME) {
  return new Blob([uint8Array.buffer.slice(uint8Array.byteOffset, uint8Array.byteOffset + uint8Array.byteLength)], {
    type: mimeType || DEFAULT_MIME
  })
}

function arrayBufferToUint8(buffer) {
  if (buffer instanceof Uint8Array) {
    return buffer
  }
  if (buffer instanceof ArrayBuffer) {
    return new Uint8Array(buffer)
  }
  if (ArrayBuffer.isView(buffer)) {
    return new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength)
  }
  throw new Error('BinaryStorageService: Expected ArrayBuffer or TypedArray')
}

function cloneValue(value) {
  if (value == null) {
    return null
  }
  if (hasStructuredClone) {
    return structuredClone(value)
  }
  try {
    return JSON.parse(JSON.stringify(value))
  } catch {
    return null
  }
}

function cloneMetadata(metadata = {}) {
  const tags = Array.isArray(metadata.tags)
    ? metadata.tags
        .map(tag => tag?.toString().trim())
        .filter(Boolean)
        .slice(0, MAX_TAGS)
    : []
  const custom = metadata.custom == null ? null : cloneValue(metadata.custom)
  return {
    filename: metadata.filename?.toString().trim() || null,
    mimeType: metadata.mimeType?.toString().trim() || null,
    tags,
    custom,
    createdAt: typeof metadata.createdAt === 'number' ? metadata.createdAt : null,
    updatedAt: typeof metadata.updatedAt === 'number' ? metadata.updatedAt : null
  }
}

export class BinaryStorageService {
  constructor() {
    this.db = null
    this.dbReady = null
    this.encryptionKey = null
    this.cipher = null
  }

  async initialize() {
    if (this.dbReady) {
      return this.dbReady
    }

    if (typeof indexedDB === 'undefined') {
      return Promise.reject(new Error('IndexedDB is not available in this environment'))
    }

    this.dbReady = new Promise((resolve, reject) => {
      let request
      try {
        request = indexedDB.open(DB_NAME, 1)
      } catch (error) {
        reject(error)
        return
      }

      request.onerror = () => {
        logger.error('BinaryStorageService: Failed to open database', request.error)
        reject(request.error)
      }

      request.onsuccess = () => {
        this.db = request.result
        resolve(this.db)
      }

      request.onupgradeneeded = (event) => {
        const db = event.target.result
        if (!db.objectStoreNames.contains(METADATA_STORE)) {
          const metadataStore = db.createObjectStore(METADATA_STORE, { keyPath: 'compositeKey' })
          metadataStore.createIndex('tenantNamespace', 'tenantNamespace', { unique: false })
          metadataStore.createIndex('namespace', 'namespace', { unique: false })
          metadataStore.createIndex('tenantId', 'tenantId', { unique: false })
          metadataStore.createIndex('updatedAt', 'updatedAt', { unique: false })
        }
        if (!db.objectStoreNames.contains(PAYLOAD_STORE)) {
          db.createObjectStore(PAYLOAD_STORE, { keyPath: 'compositeKey' })
        }
      }
    })

    return this.dbReady
  }

  setEncryptionKey(key) {
    if (!key || typeof key !== 'string') {
      logger.warn('BinaryStorageService: Invalid encryption key provided')
      return
    }
    this.encryptionKey = key
    this.cipher = new TokenCipher(key)
    logger.debug('BinaryStorageService: Encryption key set', {
      keyLength: key.length,
      cipherEnabled: this.cipher.enabled
    })
  }

  clearEncryptionKey() {
    this.encryptionKey = null
    this.cipher = null
    logger.debug('BinaryStorageService: Encryption key cleared')
  }

  async saveBlob(namespace, blobId, data, options = {}) {
    const normalizedNamespace = sanitizeNamespace(namespace)
    const normalizedBlobId = sanitizeBlobId(blobId)
    const tenantId = normalizeTenantId(options.tenantId)
    const compositeKey = buildCompositeKey(tenantId, normalizedNamespace, normalizedBlobId)
    const tenantNamespace = buildTenantNamespaceKey(tenantId, normalizedNamespace)

    const buffer = await toBinaryBuffer(data)
    const rawSize = buffer.byteLength
    const metadataOptions = cloneMetadata(options.metadata)
    const resolvedFilename =
      metadataOptions.filename ||
      (data instanceof Blob && typeof data.name === 'string' ? data.name : null) ||
      normalizedBlobId
    const resolvedMime =
      metadataOptions.mimeType ||
      (data instanceof Blob && data.type ? data.type : null) ||
      DEFAULT_MIME

    const existing = await this._getMetadata(compositeKey)
    const now = Date.now()

    const metadataEntry = {
      compositeKey,
      tenantId,
      tenantNamespace,
      namespace: normalizedNamespace,
      blobId: normalizedBlobId,
      filename: resolvedFilename,
      mimeType: resolvedMime,
      size: rawSize,
      tags: metadataOptions.tags,
      custom: metadataOptions.custom,
      createdAt: metadataOptions.createdAt ?? existing?.createdAt ?? now,
      updatedAt: metadataOptions.updatedAt ?? now,
      version: (existing?.version ?? 0) + 1,
      encrypted: Boolean(this.cipher?.enabled)
    }

    let payloadBuffer = buffer
    if (this.cipher && this.cipher.enabled) {
      const encrypted = await this.cipher.encryptBytes(buffer)
      if (encrypted instanceof ArrayBuffer) {
        payloadBuffer = encrypted
      } else {
        metadataEntry.encrypted = false
      }
    }

    await this._putEntry(metadataEntry, payloadBuffer)
    return this._toPublicMetadata(metadataEntry)
  }

  async loadBlob(namespace, blobId, options = {}) {
    const normalizedNamespace = sanitizeNamespace(namespace)
    const normalizedBlobId = sanitizeBlobId(blobId)
    const tenantId = normalizeTenantId(options.tenantId)
    const compositeKey = buildCompositeKey(tenantId, normalizedNamespace, normalizedBlobId)

    const entry = await this._getFullEntry(compositeKey)
    if (!entry) {
      return null
    }

    const buffer = await this._decodePayload(entry)
    if (!buffer) {
      return null
    }

    const asArrayBuffer = options.as === 'arrayBuffer'
    const metadata = this._toPublicMetadata(entry.metadata)

    return {
      ...metadata,
      data: asArrayBuffer ? buffer : uint8ToBlob(new Uint8Array(buffer), metadata.mimeType)
    }
  }

  async deleteBlob(namespace, blobId, options = {}) {
    const normalizedNamespace = sanitizeNamespace(namespace)
    const normalizedBlobId = sanitizeBlobId(blobId)
    const tenantId = normalizeTenantId(options.tenantId)
    const compositeKey = buildCompositeKey(tenantId, normalizedNamespace, normalizedBlobId)

    const db = await this.initialize()

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([METADATA_STORE, PAYLOAD_STORE], 'readwrite')
      transaction.onerror = () => reject(transaction.error)
      transaction.oncomplete = () => resolve(true)

      transaction.objectStore(METADATA_STORE).delete(compositeKey)
      transaction.objectStore(PAYLOAD_STORE).delete(compositeKey)
    })
  }

  async listBlobs(namespace, options = {}) {
    const normalizedNamespace = sanitizeNamespace(namespace)
    const tenantId = normalizeTenantId(options.tenantId)
    const records = await this._getMetadataByNamespace(tenantId, normalizedNamespace)
    return records.map(record => this._toPublicMetadata(record))
  }

  async clearNamespace(namespace, options = {}) {
    const normalizedNamespace = sanitizeNamespace(namespace)
    const tenantId = normalizeTenantId(options.tenantId)
    const db = await this.initialize()
    const tenantNamespaceKey = buildTenantNamespaceKey(tenantId, normalizedNamespace)

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([METADATA_STORE, PAYLOAD_STORE], 'readwrite')
      const metadataStore = transaction.objectStore(METADATA_STORE)
      const payloadStore = transaction.objectStore(PAYLOAD_STORE)
      const index = metadataStore.index('tenantNamespace')
      const range = IDBKeyRange.only(tenantNamespaceKey)

      transaction.onerror = () => reject(transaction.error)
      transaction.oncomplete = () => resolve(true)

      const cursorRequest = index.openCursor(range)
      cursorRequest.onsuccess = (event) => {
        const cursor = event.target.result
        if (!cursor) {
          return
        }
        payloadStore.delete(cursor.primaryKey)
        cursor.delete()
        cursor.continue()
      }
    })
  }

  async listNamespaces(options = {}) {
    const tenantId = normalizeTenantId(options.tenantId)
    const db = await this.initialize()

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([METADATA_STORE], 'readonly')
      const store = transaction.objectStore(METADATA_STORE)
      const index = store.index('tenantId')
      const range = IDBKeyRange.only(tenantId)
      const names = new Set()

      transaction.onerror = () => reject(transaction.error)
      const request = index.openCursor(range)
      request.onsuccess = (event) => {
        const cursor = event.target.result
        if (!cursor) {
          resolve(Array.from(names))
          return
        }
        names.add(cursor.value.namespace)
        cursor.continue()
      }
    })
  }

  async exportStore(namespace, options = {}) {
    const normalizedNamespace = sanitizeNamespace(namespace)
    const tenantId = normalizeTenantId(options.tenantId)
    const records = await this._getMetadataByNamespace(tenantId, normalizedNamespace)

    if (records.length === 0) {
      return null
    }

    const payloads = await Promise.all(
      records.map(record => this._getPayload(record.compositeKey))
    )

    const files = {}
    const manifest = {
      format: 'svelte-ide-binary-store',
      version: 1,
      namespace: normalizedNamespace,
      tenantId,
      exportedAt: new Date().toISOString(),
      blobs: []
    }

    const usedFilenames = new Set()

    for (let i = 0; i < records.length; i++) {
      const metadata = records[i]
      const payloadEntry = payloads[i]
      if (!metadata || !payloadEntry) {
        continue
      }

      const buffer = await this._decodePayload({ metadata, payload: payloadEntry })
      if (!buffer) {
        continue
      }

      const baseName = sanitizeFilename(metadata.filename, metadata.blobId)
      let fileName = baseName
      let counter = 1
      while (usedFilenames.has(fileName)) {
        const parts = baseName.split('.')
        const ext = parts.length > 1 ? `.${parts.pop()}` : ''
        const stem = parts.join('.') || metadata.blobId
        fileName = `${stem}_${counter}${ext}`
        counter++
      }
      usedFilenames.add(fileName)

      const relativePath = `${ZIP_FOLDER}/${fileName}`
      files[relativePath] = arrayBufferToUint8(buffer)

      manifest.blobs.push({
        blobId: metadata.blobId,
        filename: metadata.filename,
        mimeType: metadata.mimeType,
        size: metadata.size,
        tags: metadata.tags,
        custom: metadata.custom,
        createdAt: metadata.createdAt,
        updatedAt: metadata.updatedAt,
        encrypted: false,
        file: relativePath
      })
    }

    files[EXPORT_MANIFEST] = strToU8(JSON.stringify(manifest, null, 2))

    const compressed = zipSync(files, {
      level: typeof options.compressionLevel === 'number' ? options.compressionLevel : 6
    })

    return new Blob([compressed], { type: 'application/zip' })
  }

  async importStore(namespace, archiveInput, options = {}) {
    const normalizedNamespace = sanitizeNamespace(namespace)
    const tenantId = normalizeTenantId(options.tenantId)
    const mode = options.mode === 'replace' ? 'replace' : 'merge'
    const preserveTimestamps = options.preserveTimestamps !== false

    const archiveBuffer = await toBinaryBuffer(archiveInput)
    const archiveBytes = arrayBufferToUint8(archiveBuffer)
    const extracted = unzipSync(archiveBytes)

    if (!extracted[EXPORT_MANIFEST]) {
      throw new Error('BinaryStorageService: Invalid archive (manifest missing)')
    }

    let manifest
    try {
      manifest = JSON.parse(strFromU8(extracted[EXPORT_MANIFEST]))
    } catch (error) {
      logger.error('BinaryStorageService: Failed to parse manifest', error)
      throw new Error('BinaryStorageService: Invalid manifest format')
    }

    if (!manifest || !Array.isArray(manifest.blobs)) {
      throw new Error('BinaryStorageService: Manifest missing blobs array')
    }

    if (mode === 'replace') {
      await this.clearNamespace(normalizedNamespace, { tenantId })
    }

    const imported = []
    for (const entry of manifest.blobs) {
      const filePath = (entry.file || '').replace(/^\.?\/*/, '')
      if (!filePath || !extracted[filePath]) {
        logger.warn('BinaryStorageService: Missing blob payload in archive', { filePath })
        continue
      }

      const metadata = {
        filename: entry.filename,
        mimeType: entry.mimeType,
        tags: entry.tags,
        custom: entry.custom
      }

      if (preserveTimestamps) {
        metadata.createdAt = entry.createdAt ?? Date.now()
        metadata.updatedAt = entry.updatedAt ?? entry.createdAt ?? Date.now()
      }

      const payload = extracted[filePath]
      await this.saveBlob(normalizedNamespace, entry.blobId, payload, {
        tenantId,
        metadata
      })
      imported.push(entry.blobId)
    }

    return {
      namespace: normalizedNamespace,
      tenantId,
      importedCount: imported.length,
      importedBlobIds: imported
    }
  }

  async _getMetadata(compositeKey) {
    const db = await this.initialize()
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([METADATA_STORE], 'readonly')
      const store = transaction.objectStore(METADATA_STORE)
      const request = store.get(compositeKey)
      request.onsuccess = () => resolve(request.result || null)
      request.onerror = () => reject(request.error)
    })
  }

  async _getMetadataByNamespace(tenantId, namespace) {
    const db = await this.initialize()
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([METADATA_STORE], 'readonly')
      const store = transaction.objectStore(METADATA_STORE)
      const index = store.index('tenantNamespace')
      const range = IDBKeyRange.only(buildTenantNamespaceKey(tenantId, namespace))
      const request = index.getAll(range)

      request.onsuccess = () => resolve(request.result || [])
      request.onerror = () => reject(request.error)
    })
  }

  async _getPayload(compositeKey) {
    const db = await this.initialize()
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([PAYLOAD_STORE], 'readonly')
      const store = transaction.objectStore(PAYLOAD_STORE)
      const request = store.get(compositeKey)
      request.onsuccess = () => resolve(request.result || null)
      request.onerror = () => reject(request.error)
    })
  }

  async _getFullEntry(compositeKey) {
    const [metadata, payload] = await Promise.all([
      this._getMetadata(compositeKey),
      this._getPayload(compositeKey)
    ])
    if (!metadata || !payload) {
      return null
    }
    return { metadata, payload }
  }

  async _putEntry(metadataEntry, payloadBuffer) {
    const db = await this.initialize()
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([METADATA_STORE, PAYLOAD_STORE], 'readwrite')
      transaction.onerror = () => reject(transaction.error)
      transaction.oncomplete = () => resolve(true)

      transaction.objectStore(METADATA_STORE).put(metadataEntry)
      transaction.objectStore(PAYLOAD_STORE).put({
        compositeKey: metadataEntry.compositeKey,
        payload: payloadBuffer
      })
    })
  }

  async _decodePayload(entry) {
    const payloadBuffer = entry?.payload?.payload
    if (!payloadBuffer) {
      return null
    }
    if (!entry.metadata?.encrypted) {
      return payloadBuffer
    }
    if (!this.cipher || !this.cipher.enabled) {
      logger.warn('BinaryStorageService: Cannot decrypt blob (cipher unavailable)')
      return null
    }
    return await this.cipher.decryptBytes(payloadBuffer)
  }

  _toPublicMetadata(metadataEntry) {
    return {
      blobId: metadataEntry.blobId,
      namespace: metadataEntry.namespace,
      tenantId: metadataEntry.tenantId,
      filename: metadataEntry.filename,
      mimeType: metadataEntry.mimeType,
      size: metadataEntry.size,
      tags: metadataEntry.tags,
      custom: metadataEntry.custom,
      createdAt: metadataEntry.createdAt,
      updatedAt: metadataEntry.updatedAt,
      version: metadataEntry.version,
      encrypted: metadataEntry.encrypted
    }
  }
}

let _binaryStorageService = null

export function getBinaryStorageService() {
  if (!_binaryStorageService) {
    _binaryStorageService = new BinaryStorageService()
  }
  return _binaryStorageService
}

export const binaryStorageService = getBinaryStorageService()
