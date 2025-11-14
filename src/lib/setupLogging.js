import { configureLogger, getLoggerConfig } from '@/lib/logger.js'

const namespaces =
  import.meta.env?.VITE_LOG_NAMESPACES ??
  import.meta.env?.VITE_MODLOG ??
  ''
const level = import.meta.env?.VITE_LOG_LEVEL ?? undefined

configureLogger({ namespaces, level })

if (typeof window !== 'undefined') {
  window.ideLogs = {
    configure: configureLogger,
    setNamespaces(value) {
      configureLogger({ namespaces: value ?? '' })
    },
    setLevel(value) {
      configureLogger({ level: value })
    },
    getConfig: getLoggerConfig
  }
}
