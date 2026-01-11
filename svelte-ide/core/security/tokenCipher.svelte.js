import { createLogger } from '../../lib/logger.js'

const encoder = typeof TextEncoder !== 'undefined' ? new TextEncoder() : null
const decoder = typeof TextDecoder !== 'undefined' ? new TextDecoder() : null
const hasBase64 = typeof atob === 'function' && typeof btoa === 'function'
const logger = createLogger('core/security/token-cipher')

function hasWebCrypto() {
  return typeof window !== 'undefined' && window.crypto && window.crypto.subtle && encoder && decoder && hasBase64
}

function base64ToBytes(base64) {
  const binary = atob(base64)
  const len = binary.length
  const bytes = new Uint8Array(len)
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

function bytesToBase64(bytes) {
  let binary = ''
  const chunkSize = 0x8000
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize)
    binary += String.fromCharCode.apply(null, chunk)
  }
  return btoa(binary)
}

function toArrayBuffer(data) {
  if (data instanceof ArrayBuffer) {
    return data
  }
  if (ArrayBuffer.isView(data)) {
    return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength)
  }
  if (data == null) {
    return new ArrayBuffer(0)
  }
  logger.warn('TokenCipher: Expected ArrayBuffer or TypedArray for binary operation, received', typeof data)
  return null
}

export class TokenCipher {
  constructor(rawKey) {
    this.rawKey = rawKey
    this.enabled = hasWebCrypto() && rawKey && rawKey.length >= 32
    this.keyPromise = null
  }

  async getKey() {
    if (!this.enabled) {
      return null
    }
    if (this.keyPromise) {
      return this.keyPromise
    }
    this.keyPromise = (async () => {
      try {
        const keyBytes = base64ToBytes(this.rawKey)
        return await window.crypto.subtle.importKey(
          'raw',
          keyBytes,
          { name: 'AES-GCM' },
          false,
          ['encrypt', 'decrypt']
        )
      } catch (error) {
        logger.warn('TokenCipher: Failed to import encryption key, disabling encryption', error)
        this.enabled = false
        return null
      }
    })()
    return this.keyPromise
  }

  async encrypt(plaintext) {
    if (!this.enabled) {
      return plaintext
    }

    try {
      const key = await this.getKey()
      if (!key) {
        return plaintext
      }

      const iv = window.crypto.getRandomValues(new Uint8Array(12))
      const data = encoder.encode(plaintext)
      const ciphertext = await window.crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        key,
        data
      )

      const resultBytes = new Uint8Array(iv.length + ciphertext.byteLength)
      resultBytes.set(iv, 0)
      resultBytes.set(new Uint8Array(ciphertext), iv.length)

      return bytesToBase64(resultBytes)
    } catch (error) {
      logger.warn('TokenCipher: Encryption failed, storing plaintext instead', error)
      return plaintext
    }
  }

  async decrypt(payload) {
    if (!this.enabled) {
      return payload
    }

    try {
      const key = await this.getKey()
      if (!key) {
        return payload
      }

      const bytes = base64ToBytes(payload)
      if (bytes.length <= 12) {
        return payload
      }

      const iv = bytes.subarray(0, 12)
      const data = bytes.subarray(12)

      const decrypted = await window.crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        key,
        data
      )

      return decoder.decode(decrypted)
    } catch (error) {
      logger.warn('TokenCipher: Decryption failed, clearing stored tokens', error)
      return null
    }
  }

  async encryptBytes(data) {
    if (!this.enabled) {
      return toArrayBuffer(data) || data
    }

    try {
      const key = await this.getKey()
      if (!key) {
        return toArrayBuffer(data) || data
      }

      const buffer = toArrayBuffer(data)
      if (!buffer) {
        return data
      }

      const iv = window.crypto.getRandomValues(new Uint8Array(12))
      const ciphertext = await window.crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        key,
        buffer
      )

      const resultBytes = new Uint8Array(iv.length + ciphertext.byteLength)
      resultBytes.set(iv, 0)
      resultBytes.set(new Uint8Array(ciphertext), iv.length)

      return resultBytes.buffer
    } catch (error) {
      logger.warn('TokenCipher: encryptBytes failed, returning plaintext buffer', error)
      return toArrayBuffer(data) || data
    }
  }

  async decryptBytes(payload) {
    const buffer = toArrayBuffer(payload)
    if (!buffer) {
      return null
    }

    if (!this.enabled) {
      return buffer
    }

    try {
      const key = await this.getKey()
      if (!key) {
        return buffer
      }

      const bytes = new Uint8Array(buffer)
      if (bytes.length <= 12) {
        return buffer
      }

      const iv = bytes.subarray(0, 12)
      const data = bytes.subarray(12)

      const decrypted = await window.crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        key,
        data
      )

      return decrypted
    } catch (error) {
      logger.warn('TokenCipher: decryptBytes failed, returning null', error)
      return null
    }
  }
}
