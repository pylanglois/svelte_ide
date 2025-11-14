/**
 * Utilitaires de test pour la ré-authentification
 * 
 * Ces fonctions sont exposées dans window.testReAuth pour faciliter les tests manuels.
 * 
 * Usage dans la console du navigateur :
 * 
 * // Simuler une expiration de session
 * testReAuth.triggerExpiration()
 * 
 * // Simuler une expiration avec message personnalisé
 * testReAuth.triggerExpiration('Test : session expirée après 2 jours')
 * 
 * // Forcer un auto-refresh (utile pour tester le retry)
 * testReAuth.forceRefresh()
 * 
 * // Inspecter l'état actuel
 * testReAuth.inspectState()
 */

import { eventBus } from '@/core/EventBusService.svelte.js'
import { indexedDBService } from '@/core/persistence/IndexedDBService.svelte.js'
import { createLogger } from '@/lib/logger.js'
import { getAuthStore } from '@/stores/authStore.svelte.js'

const authStore = getAuthStore()
const testReAuthLogger = createLogger('test-tools/re-auth')

export const testReAuth = {
  /**
   * Déclenche manuellement l'événement d'expiration de session
   */
  triggerExpiration(message = 'Test manuel : session expirée') {
    testReAuthLogger.log('🧪 Test : déclenchement événement auth:session-expired')
    eventBus.publish('auth:session-expired', {
      message,
      timestamp: Date.now()
    })
  },

  /**
   * Force un refresh de token (utile pour tester le retry)
   */
  async forceRefresh() {
    testReAuthLogger.log('🧪 Test : force refresh du token')
    try {
      const result = await authStore.refreshToken()
      testReAuthLogger.log('✅ Refresh réussi:', result)
      return result
    } catch (error) {
      testReAuthLogger.error('❌ Refresh échoué:', error)
      throw error
    }
  },

  /**
   * Inspecte l'état actuel de l'authentification et du chiffrement
   */
  inspectState() {
    const state = {
      isAuthenticated: authStore.isAuthenticated,
      hasEncryptionKey: authStore.hasEncryptionKey,
      encryptionKeyLength: authStore.encryptionKey?.length,
      userSub: authStore.userInfo?.sub,
      userName: authStore.userInfo?.name,
      tokenPresent: !!authStore.accessToken,
      indexedDBReady: indexedDBService.isInitialized
    }

    testReAuthLogger.table(state)
    return state
  },

  /**
   * Teste le cycle complet : save → logout → reauth → load
   */
  async testFullCycle() {
    testReAuthLogger.log('🧪 Test : cycle complet save/logout/reauth/load')

    // 1. Sauvegarder des données
    const testData = {
      secret: 'Données confidentielles',
      timestamp: Date.now()
    }

    testReAuthLogger.log('1️⃣ Sauvegarde de données chiffrées...')
    await indexedDBService.save('test-reauth', 'cycle-test', testData)
    testReAuthLogger.log('✅ Données sauvegardées:', testData)

    // 2. Se déconnecter
    testReAuthLogger.log('2️⃣ Déconnexion...')
    await authStore.logout()
    testReAuthLogger.log('✅ Déconnecté')

    // 3. Vérifier que les données ne sont plus accessibles
    testReAuthLogger.log('3️⃣ Tentative de lecture sans clé...')
    try {
      await indexedDBService.load('test-reauth', 'cycle-test')
      testReAuthLogger.warn('⚠️ Les données sont encore accessibles (pas normal)')
    } catch (error) {
      testReAuthLogger.log('✅ Erreur attendue (pas de clé):', error.message)
    }

    // 4. Simuler l'expiration pour afficher le modal
    testReAuthLogger.log('4️⃣ Déclenchement du modal de ré-auth...')
    this.triggerExpiration('Test cycle complet : veuillez vous reconnecter')

    testReAuthLogger.log('👉 Authentifiez-vous via le modal, puis appelez testReAuth.verifyRestore()')
  },

  /**
   * Vérifie la restauration des données après ré-authentification
   */
  async verifyRestore() {
    testReAuthLogger.log('🧪 Test : vérification de la restauration')

    if (!authStore.isAuthenticated) {
      testReAuthLogger.error('❌ Vous devez être authentifié pour vérifier la restauration')
      return
    }

    if (!authStore.hasEncryptionKey) {
      testReAuthLogger.error('❌ Pas de clé de chiffrement disponible')
      return
    }

    testReAuthLogger.log('1️⃣ Lecture des données chiffrées...')
    const data = await indexedDBService.load('test-reauth', 'cycle-test')
    
    if (data && data.secret === 'Données confidentielles') {
      testReAuthLogger.log('✅ SUCCÈS : Données restaurées correctement!', data)
      testReAuthLogger.log('🎉 Le cycle complet fonctionne!')
    } else {
      testReAuthLogger.error('❌ ÉCHEC : Données incorrectes ou manquantes', data)
    }

    // Nettoyage
    await indexedDBService.delete('test-reauth', 'cycle-test')
    testReAuthLogger.log('🧹 Nettoyage effectué')
  },

  /**
   * Nettoie toutes les données de test
   */
  async cleanup() {
    testReAuthLogger.log('🧹 Nettoyage des données de test...')
    await indexedDBService.clear('test-reauth')
    testReAuthLogger.log('✅ Nettoyage terminé')
  }
}

// Exposer dans window pour les tests manuels
if (typeof window !== 'undefined') {
  window.testReAuth = testReAuth
  testReAuthLogger.log('🧪 testReAuth disponible dans window.testReAuth')
  testReAuthLogger.log('   Exemples :')
  testReAuthLogger.log('   - testReAuth.triggerExpiration()')
  testReAuthLogger.log('   - testReAuth.inspectState()')
  testReAuthLogger.log('   - testReAuth.testFullCycle()')
}
