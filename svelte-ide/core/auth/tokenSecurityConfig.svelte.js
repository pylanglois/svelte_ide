const ALLOWED_PERSISTENCE = new Set(['memory', 'session', 'local'])

function normalize(value, fallback) {
  if (!value || typeof value !== 'string') {
    return fallback
  }
  const normalized = value.trim().toLowerCase()
  return normalized || fallback
}

function resolvePersistence() {
  const backendToggle =
    import.meta.env.VITE_GOOGLE_USE_BACKEND === 'true' ||
    import.meta.env.VITE_GOOGLE_USE_BACKEND === '1' ||
    Boolean(import.meta.env.VITE_GOOGLE_BACKEND_TOKEN_URL) ||
    Boolean(import.meta.env.VITE_GOOGLE_BACKEND_REFRESH_URL)

  const rawPersistence = normalize(import.meta.env.VITE_AUTH_TOKEN_PERSISTENCE, backendToggle ? 'memory' : 'session')

  if (ALLOWED_PERSISTENCE.has(rawPersistence)) {
    return rawPersistence
  }
  return backendToggle ? 'memory' : 'session'
}

export function getTokenSecurityConfig() {
  const persistence = resolvePersistence()
  const encryptionKey = (import.meta.env.VITE_AUTH_TOKEN_ENCRYPTION_KEY || '').trim()
  const auditAccess = import.meta.env.VITE_AUTH_LOG_TOKEN_ACCESSES === 'true'

  return {
    persistence,
    encryptionKey,
    auditAccess
  }
}
