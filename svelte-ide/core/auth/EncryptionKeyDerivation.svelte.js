import { createLogger } from '../../lib/logger.js'
import { getAppKey } from '../config/appKey.js'

const logger = createLogger('core/auth/key-derivation')


function hasWebCrypto() {
  return (
    typeof window !== 'undefined' &&
    window.crypto &&
    window.crypto.subtle &&
    typeof TextEncoder !== 'undefined' &&
    typeof btoa === 'function'
  )
}


function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  const chunkSize = 0x8000
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize)
    binary += String.fromCharCode.apply(null, chunk)
  }
  return btoa(binary)
}


function validateUserInfo(userInfo) {
  if (!userInfo) {
    return { valid: false, error: 'userInfo is null or undefined' }
  }

  if (typeof userInfo !== 'object') {
    return { valid: false, error: 'userInfo must be an object' }
  }

  
  if (!userInfo.sub) {
    return { valid: false, error: 'userInfo.sub is required for key derivation' }
  }

  if (typeof userInfo.sub !== 'string') {
    return { valid: false, error: 'userInfo.sub must be a string' }
  }

  if (userInfo.sub.trim().length === 0) {
    return { valid: false, error: 'userInfo.sub cannot be empty' }
  }

  return { valid: true }
}


export async function deriveEncryptionKey(userInfo) {
  
  if (!hasWebCrypto()) {
    logger.error('WebCrypto API not available, cannot derive encryption key')
    throw new Error('WebCrypto API is required for encryption but not available in this environment')
  }

  
  const validation = validateUserInfo(userInfo)
  if (!validation.valid) {
    logger.error('Invalid userInfo for key derivation', { error: validation.error })
    throw new Error(`Key derivation failed: ${validation.error}`)
  }

  try {
    
    
    const appKey = getAppKey()
    const derivationString = `${appKey}:${userInfo.sub.trim()}:encryption`
    
    logger.debug('Deriving encryption key', {
      appKey: appKey.substring(0, 8) + '...',
      userSub: userInfo.sub.substring(0, 8) + '...',
      derivationLength: derivationString.length
    })

    
    const encoder = new TextEncoder()
    const data = encoder.encode(derivationString)

    
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', data)

    
    const base64Key = arrayBufferToBase64(hashBuffer)

    logger.debug('Encryption key derived successfully', {
      keyLength: base64Key.length,
      keyPreview: base64Key.substring(0, 8) + '...'
    })

    return base64Key
  } catch (error) {
    logger.error('Failed to derive encryption key', error)
    throw new Error(`Encryption key derivation failed: ${error.message}`)
  }
}


export function isValidEncryptionKey(key) {
  if (!key || typeof key !== 'string') {
    return false
  }

  
  
  if (key.length !== 44) {
    logger.warn('Invalid encryption key length', { length: key.length, expected: 44 })
    return false
  }

  
  const base64Regex = /^[A-Za-z0-9+/]+={0,2}$/
  if (!base64Regex.test(key)) {
    logger.warn('Invalid encryption key format (not base64)')
    return false
  }

  return true
}


export function clearEncryptionKey(key) {
  if (!key) return

  logger.debug('Clearing encryption key from memory')
  
  
  
  key = null
  
  
  if (typeof global !== 'undefined' && global.gc) {
    global.gc()
  }
}
