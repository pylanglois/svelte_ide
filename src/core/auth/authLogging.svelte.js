import { createLogger } from '@/lib/logger.js'

const DEBUG_ENABLED =
  import.meta.env.DEV ||
  import.meta.env.VITE_AUTH_DEBUG_LOGS === 'true'

const logger = createLogger('auth')

function print(method, message, context) {
  const logMethod = typeof logger[method] === 'function' ? logger[method] : logger.info
  if (context !== undefined) {
    logMethod(message, context)
  } else {
    logMethod(message)
  }
}

export function authDebug(message, context) {
  if (!DEBUG_ENABLED) {
    return
  }
  print('debug', message, context)
}

export function authWarn(message, context) {
  print('warn', message, context)
}

export function authError(message, context) {
  print('error', message, context)
}
