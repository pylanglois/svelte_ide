const sanitizeKey = (value) => {
  if (typeof value !== 'string') return ''
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : ''
}

const envKey = typeof import.meta !== 'undefined' && import.meta.env
  ? sanitizeKey(import.meta.env.VITE_APP_KEY)
  : ''

const globalKey = typeof window !== 'undefined'
  ? sanitizeKey(window.__SVELTE_IDE_APP_KEY__)
  : ''

const resolvedKey = envKey || globalKey

if (!resolvedKey) {
  throw new Error('APP_KEY is required. Set VITE_APP_KEY or window.__SVELTE_IDE_APP_KEY__.')
}

export const APP_KEY = resolvedKey

export const namespacedKey = (baseKey) => {
  if (!baseKey || typeof baseKey !== 'string') {
    throw new Error('namespacedKey() requires a non-empty string')
  }
  return `${APP_KEY}-${baseKey}`
}
