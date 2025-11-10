const GLOBAL_KEY = '__svelteIdeModlog__'
const FILTERED_METHODS = ['log', 'info', 'debug']

function initModlog() {
  if (typeof window === 'undefined' || typeof console === 'undefined') {
    return
  }

  const rawConfig = readRawConfig()
  const existingState = window[GLOBAL_KEY]

  if (existingState?.applyConfig) {
    existingState.applyConfig(rawConfig)
    return
  }

  const state = {
    config: buildConfig(rawConfig),
    originals: {},
    applyConfig(newConfig) {
      state.config = buildConfig(newConfig)
    }
  }

  FILTERED_METHODS.forEach(method => {
    if (typeof console[method] !== 'function') {
      return
    }

    const original = console[method].bind(console)
    state.originals[method] = original

    console[method] = (...args) => {
      const { allowAll, filters } = state.config
      if (allowAll) {
        original(...args)
        return
      }
      if (filters.length === 0) {
        return
      }

      const moduleInfo = getCallerModule()
      if (!moduleInfo) {
        return
      }

      if (!matchesFilter(moduleInfo.normalized, filters)) {
        return
      }

      original(`[${moduleInfo.label}]`, ...args)
    }
  })

  window[GLOBAL_KEY] = state
  window.setModLogFilters = value => {
    state.applyConfig(value)
  }
}

function readRawConfig() {
  const envValue = import.meta?.env?.VITE_MODLOG ?? ''

  if (typeof window === 'undefined') {
    return envValue
  }

  const runtimeOverride =
    typeof window.MODLOG === 'string' ? window.MODLOG : undefined
  const urlOverride = getUrlOverride()
  const localStorageOverride = getLocalStorageOverride()

  return (
    runtimeOverride ??
    urlOverride ??
    localStorageOverride ??
    envValue ??
    ''
  )
}

function getUrlOverride() {
  if (typeof window === 'undefined' || !window.location) {
    return undefined
  }
  try {
    const params = new URLSearchParams(window.location.search)
    return params.get('modlog') ?? undefined
  } catch {
    return undefined
  }
}

function getLocalStorageOverride() {
  if (typeof window === 'undefined' || !window.localStorage) {
    return undefined
  }
  try {
    return window.localStorage.getItem('MODLOG') ?? undefined
  } catch {
    return undefined
  }
}

function buildConfig(rawValue) {
  const tokens = (rawValue ?? '')
    .split(',')
    .map(token => token.trim().toLowerCase())
    .filter(Boolean)

  const allowAll = tokens.includes('*')
  return {
    allowAll,
    filters: allowAll ? [] : tokens
  }
}

function matchesFilter(moduleId, filters) {
  return filters.some(token => moduleId.includes(token))
}

function getCallerModule() {
  const err = new Error()
  if (!err.stack) {
    return null
  }

  const lines = err.stack.split('\n').slice(2)
  for (const line of lines) {
    const match = line.match(/(\/src\/[^:\s)]+)(?::\d+:\d+)?/i)
    if (!match) {
      continue
    }

    const fullPath = match[1]
    const withoutQuery = fullPath.replace(/\?.*$/, '')
    const normalizedPath = withoutQuery.replace(/^.*\/src\//, '')
    const label = normalizedPath.replace(/\.(svelte|js|ts|mjs|cjs|jsx|tsx)$/i, '')

    if (!label) {
      continue
    }

    return {
      label,
      normalized: label.toLowerCase()
    }
  }

  return null
}

initModlog()
