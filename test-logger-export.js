// Test rapide pour vérifier que le logger est exporté correctement
import { createLogger, configureLogger, getLoggerConfig } from './src/public-api.js'

console.log('✅ Import réussi: createLogger, configureLogger, getLoggerConfig')

// Test de configuration
configureLogger({ namespaces: 'test', level: 'debug' })
console.log('✅ configureLogger() fonctionne')

// Test de getLoggerConfig
const config = getLoggerConfig()
console.log('✅ getLoggerConfig() fonctionne:', config)

// Test de createLogger
const logger = createLogger('test/demo')
console.log('✅ createLogger() fonctionne')

// Test des méthodes
logger.debug('Test debug')
logger.info('Test info')
logger.warn('Test warn')
logger.error('Test error')
console.log('✅ Toutes les méthodes du logger fonctionnent')

console.log('\n✅ TOUS LES TESTS PASSÉS - Le logger est bien exporté dans l\'API publique')
