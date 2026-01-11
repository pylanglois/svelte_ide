import { configureLogger, createLogger } from './logger.js'

const namespaces = import.meta.env?.VITE_LOG_NAMESPACES ?? ''
const level = import.meta.env?.VITE_LOG_LEVEL ?? undefined

configureLogger({ namespaces, level })

const logger = createLogger('core/logger')
logger.info('logger ready')
