import { authDebug, authError, authWarn } from '@/core/auth/authLogging.svelte.js'
import { APP_KEY } from '@/core/config/appKey.js'

/**
 * Vérifie si l'environnement supporte les APIs crypto nécessaires
 * @returns {boolean}
 */
function hasWebCrypto() {
  return (
    typeof window !== 'undefined' &&
    window.crypto &&
    window.crypto.subtle &&
    typeof TextEncoder !== 'undefined' &&
    typeof btoa === 'function'
  )
}

/**
 * Convertit un ArrayBuffer en string base64
 * @param {ArrayBuffer} buffer
 * @returns {string}
 */
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

/**
 * Valide que userInfo contient les informations minimales requises
 * @param {object} userInfo
 * @returns {{ valid: boolean, error?: string }}
 */
function validateUserInfo(userInfo) {
  if (!userInfo) {
    return { valid: false, error: 'userInfo is null or undefined' }
  }

  if (typeof userInfo !== 'object') {
    return { valid: false, error: 'userInfo must be an object' }
  }

  // Le champ 'sub' (subject) est standard OAuth2/OIDC et identifie l'utilisateur de manière unique
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

/**
 * Dérive une clé de chiffrement unique par utilisateur à partir de son userInfo
 * 
 * La clé est dérivée de manière déterministe à partir de :
 * - APP_KEY : Clé unique de l'application (namespace global)
 * - userInfo.sub : Identifiant unique de l'utilisateur (standard OAuth2/OIDC)
 * - Suffixe 'encryption' : Différencie du namespace général
 * 
 * Avantages :
 * - Clé unique par utilisateur
 * - Reproductible (même clé à chaque session pour un même user)
 * - Pas besoin de stocker la clé (re-calculée à la demande)
 * - Compatible avec architecture OAuth existante
 * 
 * Sécurité :
 * - Utilise SHA-256 (256 bits) pour AES-GCM
 * - Pas de collision possible entre utilisateurs (sub unique)
 * - Namespace par APP_KEY (isolation multi-apps)
 * 
 * @param {object} userInfo - Informations utilisateur (doit contenir userInfo.sub)
 * @returns {Promise<string>} Clé de chiffrement encodée en base64 (compatible TokenCipher)
 * @throws {Error} Si WebCrypto indisponible ou userInfo invalide
 * 
 * @example
 * const userInfo = { sub: 'google-oauth2|123456789', email: 'user@example.com' }
 * const key = await deriveEncryptionKey(userInfo)
 * // key = "a3Jf9k2L..." (32 bytes en base64)
 */
export async function deriveEncryptionKey(userInfo) {
  // Vérification environnement
  if (!hasWebCrypto()) {
    authError('WebCrypto API not available, cannot derive encryption key')
    throw new Error('WebCrypto API is required for encryption but not available in this environment')
  }

  // Validation userInfo
  const validation = validateUserInfo(userInfo)
  if (!validation.valid) {
    authError('Invalid userInfo for key derivation', { error: validation.error })
    throw new Error(`Key derivation failed: ${validation.error}`)
  }

  try {
    // Construction de la chaîne de dérivation
    // Format : "APP_KEY:user_sub:encryption"
    const derivationString = `${APP_KEY}:${userInfo.sub.trim()}:encryption`
    
    authDebug('Deriving encryption key', {
      appKey: APP_KEY.substring(0, 8) + '...',
      userSub: userInfo.sub.substring(0, 8) + '...',
      derivationLength: derivationString.length
    })

    // Encodage en bytes
    const encoder = new TextEncoder()
    const data = encoder.encode(derivationString)

    // Hash SHA-256 (produit 32 bytes = 256 bits)
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', data)

    // Conversion en base64 pour compatibilité TokenCipher
    const base64Key = arrayBufferToBase64(hashBuffer)

    authDebug('Encryption key derived successfully', {
      keyLength: base64Key.length,
      keyPreview: base64Key.substring(0, 8) + '...'
    })

    return base64Key
  } catch (error) {
    authError('Failed to derive encryption key', error)
    throw new Error(`Encryption key derivation failed: ${error.message}`)
  }
}

/**
 * Vérifie si une clé dérivée est valide (format et longueur)
 * @param {string} key - Clé à valider
 * @returns {boolean}
 */
export function isValidEncryptionKey(key) {
  if (!key || typeof key !== 'string') {
    return false
  }

  // Une clé SHA-256 en base64 fait toujours 44 caractères
  // (32 bytes × 4/3 pour base64 = 42.67, arrondi à 44 avec padding)
  if (key.length !== 44) {
    authWarn('Invalid encryption key length', { length: key.length, expected: 44 })
    return false
  }

  // Vérification basique du format base64
  const base64Regex = /^[A-Za-z0-9+/]+={0,2}$/
  if (!base64Regex.test(key)) {
    authWarn('Invalid encryption key format (not base64)')
    return false
  }

  return true
}

/**
 * Efface une clé de la mémoire (best effort)
 * Note: JavaScript ne permet pas de garantir l'effacement complet de la mémoire
 * @param {string} key
 */
export function clearEncryptionKey(key) {
  if (!key) return

  authDebug('Clearing encryption key from memory')
  
  // En JavaScript, on ne peut pas vraiment effacer la mémoire
  // Mais on peut au moins éviter de garder des références
  key = null
  
  // Suggestion au GC de nettoyer (non garanti)
  if (typeof global !== 'undefined' && global.gc) {
    global.gc()
  }
}
