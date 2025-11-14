const LEVEL_PRIORITY = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3
}

const DEFAULT_LEVEL = import.meta.env.DEV ? 'debug' : 'info'

const state = {
  level: DEFAULT_LEVEL,
  namespaces: [],
  allowAll: false
}

export function configureLogger(options = {}) {
  const { level, namespaces } = options

  if (typeof level === 'string') {
    const normalized = level.toLowerCase()
    if (normalized in LEVEL_PRIORITY) {
      state.level = normalized
    }
  }

  if (typeof namespaces === 'string') {
    const parsed = parseNamespaces(namespaces)
    state.allowAll = parsed.allowAll
    state.namespaces = parsed.tokens
  } else if (namespaces === '') {
    state.allowAll = false
    state.namespaces = []
  }
}

export function getLoggerConfig() {
  return {
    level: state.level,
    namespaces: [...state.namespaces],
    allowAll: state.allowAll
  }
}

export function createLogger(namespace = 'app') {
  const label = namespace
  const prefix = `[${label}]`
  const normalizedNamespace = namespace.toLowerCase()

  function emit(level, args) {
    if (!shouldLog(level, normalizedNamespace)) {
      return
    }

    const consoleMethod = console[level] ? level : 'log'
    console[consoleMethod](prefix, ...args)
  }

  function emitTable(args) {
    if (!shouldLog('info', normalizedNamespace)) {
      return
    }

    if (typeof console.table === 'function') {
      console.info(prefix)
      console.table(...args)
    } else {
      const consoleMethod = console.info ? 'info' : 'log'
      console[consoleMethod](prefix, ...args)
    }
  }

  return {
    debug: (...args) => emit('debug', args),
    info: (...args) => emit('info', args),
    log: (...args) => emit('info', args),
    warn: (...args) => emit('warn', args),
    error: (...args) => emit('error', args),
    table: (...args) => emitTable(args)
  }
}

function shouldLog(level, namespace) {
  const currentLevel = state.level in LEVEL_PRIORITY ? state.level : DEFAULT_LEVEL
  const logLevel = level in LEVEL_PRIORITY ? level : 'debug'

  if (LEVEL_PRIORITY[logLevel] < LEVEL_PRIORITY[currentLevel]) {
    return false
  }

  if (state.allowAll) {
    return true
  }

  return state.namespaces.some(token => namespace.includes(token))
}

function parseNamespaces(rawValue) {
  const tokens = (rawValue ?? '')
    .split(',')
    .map(token => token.trim().toLowerCase())
    .filter(Boolean)

  const allowAll = tokens.includes('*')
  const filteredTokens = tokens.filter(token => token !== '*')

  return {
    allowAll,
    tokens: filteredTokens
  }
}
