/**
 * Utilitaires de test pour l'auto-refresh avec expiration rapide
 * 
 * Ces fonctions permettent de tester le mécanisme d'auto-refresh en forçant
 * des tokens de courte durée (30s) pour valider le timing, le retry et la
 * restauration de la clé de chiffrement.
 * 
 * Usage dans la console du navigateur :
 * 
 * // Activer le mode test (tokens de 30s au lieu de 3600s)
 * testAutoRefresh.enableFastExpiration()
 * 
 * // Se connecter (tokens expireront dans 30s)
 * await authStore.login('mock')
 * 
 * // Observer les logs : le refresh devrait se déclencher à 25s (5s avant expiration)
 * // Vérifier dans la console :
 * // - "Auto-refresh programmé dans Xs"
 * // - "Auto-refresh tenté (1/3)"
 * // - "Token rafraîchi avec succès"
 * 
 * // Simuler un échec de refresh pour tester le retry
 * testAutoRefresh.enableRefreshFailure(2) // Échoue 2 fois puis réussit
 * 
 * // Restaurer le comportement normal
 * testAutoRefresh.disableFastExpiration()
 */

import { eventBus } from '@/core/EventBusService.svelte.js'
import { createLogger } from '@/lib/logger.js'
import { getAuthStore } from '@/stores/authStore.svelte.js'

const authStore = getAuthStore()
const testAutoRefreshLogger = createLogger('test-tools/auto-refresh')

// Configuration de test
let fastExpirationEnabled = false
let refreshFailureCount = 0
let refreshAttemptCounter = 0

export const testAutoRefresh = {
  /**
   * Active le mode expiration rapide (tokens de 30s)
   */
  enableFastExpiration() {
    fastExpirationEnabled = true
    testAutoRefreshLogger.log('🧪 Mode expiration rapide ACTIVÉ')
    testAutoRefreshLogger.log('   → Les tokens expireront dans 30 secondes')
    testAutoRefreshLogger.log('   → Le refresh se déclenchera à 25 secondes')
    testAutoRefreshLogger.log('   → Reconnectez-vous pour appliquer')
  },

  /**
   * Désactive le mode expiration rapide (retour à 3600s)
   */
  disableFastExpiration() {
    fastExpirationEnabled = false
    refreshFailureCount = 0
    refreshAttemptCounter = 0
    testAutoRefreshLogger.log('🧪 Mode expiration rapide DÉSACTIVÉ')
    testAutoRefreshLogger.log('   → Les tokens retournent à leur durée normale')
  },

  /**
   * Force les N prochains refresh à échouer (pour tester le retry)
   */
  enableRefreshFailure(failureCount = 1) {
    refreshFailureCount = failureCount
    refreshAttemptCounter = 0
    testAutoRefreshLogger.log(`🧪 Échec de refresh ACTIVÉ : ${failureCount} tentative(s) échoueront`)
    testAutoRefreshLogger.log('   → Utilisé pour tester le retry avec backoff exponentiel')
  },

  /**
   * Hook appelé par MockProvider pour savoir s'il doit simuler un échec
   * (Exposé pour être accessible depuis window.testAutoRefresh)
   */
  shouldSimulateRefreshFailure() {
    if (refreshFailureCount > 0 && refreshAttemptCounter < refreshFailureCount) {
      refreshAttemptCounter++
      testAutoRefreshLogger.log(`🧪 [Simulate] Échec de refresh simulé (${refreshAttemptCounter}/${refreshFailureCount})`)
      return true
    }
    return false
  },

  /**
   * Retourne la configuration actuelle
   */
  getConfig() {
    return {
      fastExpirationEnabled,
      refreshFailureCount,
      refreshAttemptCounter,
      tokenExpirySeconds: fastExpirationEnabled ? 30 : 3600,
      refreshTriggerSeconds: fastExpirationEnabled ? 25 : 3295 // 5s avant expiration
    }
  },

  /**
   * Affiche le statut actuel du token et du refresh
   */
  async inspectTokenState() {
    const config = this.getConfig()
    const state = {
      isAuthenticated: authStore.isAuthenticated,
      hasEncryptionKey: authStore.hasEncryptionKey,
      encryptionKeyLength: authStore.encryptionKey?.length,
      userName: authStore.userInfo?.name,
      userSub: authStore.userInfo?.sub,
      
      // Configuration de test
      fastExpirationMode: config.fastExpirationEnabled,
      tokenWillExpireInSeconds: config.tokenExpirySeconds,
      refreshWillTriggerAtSeconds: config.refreshTriggerSeconds,
      
      // État du retry
      simulatedFailuresRemaining: refreshFailureCount - refreshAttemptCounter,
      totalRefreshAttempts: refreshAttemptCounter
    }

    testAutoRefreshLogger.log('🔍 État du Token et Auto-Refresh :')
    testAutoRefreshLogger.table(state)
    
    return state
  },

  /**
   * Démarre un test complet : login → attendre refresh → vérifier clé restaurée
   */
  async runFullAutoRefreshTest() {
    testAutoRefreshLogger.log('🧪 === TEST COMPLET AUTO-REFRESH ===\n')

    // 1. Vérifier l'état initial
    testAutoRefreshLogger.log('1️⃣ Vérification état initial...')
    if (authStore.isAuthenticated) {
      testAutoRefreshLogger.log('⚠️ Déjà authentifié. Déconnexion...')
      await authStore.logout()
      await new Promise(resolve => setTimeout(resolve, 500))
    }
    testAutoRefreshLogger.log('✅ Déconnecté\n')

    // 2. Activer le mode expiration rapide
    testAutoRefreshLogger.log('2️⃣ Activation mode expiration rapide (30s)...')
    this.enableFastExpiration()
    testAutoRefreshLogger.log('✅ Mode activé\n')

    // 3. Se connecter
    testAutoRefreshLogger.log('3️⃣ Connexion avec MockProvider...')
    const loginResult = await authStore.login('mock')
    if (!loginResult.success) {
      testAutoRefreshLogger.error('❌ Échec de connexion:', loginResult.error)
      return
    }
    testAutoRefreshLogger.log('✅ Connexion réussie')
    testAutoRefreshLogger.log('   Authenticated:', authStore.isAuthenticated)
    testAutoRefreshLogger.log('   User:', authStore.userInfo?.name)
    testAutoRefreshLogger.log('   Encryption Key:', authStore.encryptionKey?.substring(0, 20) + '...\n')

    // 4. Sauvegarder des données de test dans IndexedDB
    testAutoRefreshLogger.log('4️⃣ Sauvegarde de données de test...')
    const testData = {
      timestamp: Date.now(),
      message: 'Test auto-refresh',
      randomValue: Math.random()
    }
    
    if (window.indexedDBService) {
      await window.indexedDBService.save('test-auto-refresh', 'test-key', testData)
      testAutoRefreshLogger.log('✅ Données sauvegardées:', testData, '\n')
    } else {
      testAutoRefreshLogger.warn('⚠️ IndexedDB non initialisé (attendu si pas dans App.svelte)\n')
    }

    // 5. Attendre le refresh (25 secondes)
    testAutoRefreshLogger.log('5️⃣ Attente du refresh automatique (25 secondes)...')
    testAutoRefreshLogger.log('   → Observez les logs ci-dessous pour voir le refresh se déclencher\n')

    // Écouter l'événement de refresh réussi
    const unsubscribeRefresh = eventBus.subscribe('auth:token-refreshed', (data) => {
      testAutoRefreshLogger.log('🎉 TOKEN REFRESH RÉUSSI!')
      testAutoRefreshLogger.log('   Nouvelle encryption key:', authStore.encryptionKey?.substring(0, 20) + '...')
      testAutoRefreshLogger.log('   Timestamp:', new Date().toISOString())
    })

    // Écouter l'événement d'expiration
    const unsubscribeExpired = eventBus.subscribe('auth:session-expired', (data) => {
      testAutoRefreshLogger.error('❌ SESSION EXPIRÉE (tous les retries ont échoué)')
      testAutoRefreshLogger.error('   Message:', data.message)
    })

    // Attendre 35 secondes pour laisser le temps au refresh de se déclencher
    await new Promise(resolve => setTimeout(resolve, 35000))

    // 6. Vérifier que les données sont toujours accessibles
    testAutoRefreshLogger.log('\n6️⃣ Vérification de l\'accès aux données...')
    if (window.indexedDBService && authStore.hasEncryptionKey) {
      try {
        const loadedData = await window.indexedDBService.load('test-auto-refresh', 'test-key')
        
        if (loadedData && loadedData.message === testData.message) {
          testAutoRefreshLogger.log('✅ SUCCÈS : Données restaurées après refresh!')
          testAutoRefreshLogger.log('   Données:', loadedData)
        } else {
          testAutoRefreshLogger.error('❌ ÉCHEC : Données incorrectes')
          testAutoRefreshLogger.error('   Attendu:', testData)
          testAutoRefreshLogger.error('   Reçu:', loadedData)
        }
      } catch (error) {
        testAutoRefreshLogger.error('❌ ÉCHEC : Erreur lors de la lecture des données')
        testAutoRefreshLogger.error('   Erreur:', error.message)
      }
    } else {
      testAutoRefreshLogger.warn('⚠️ Impossible de vérifier les données (IndexedDB ou clé manquante)')
    }

    // 7. Nettoyage
    testAutoRefreshLogger.log('\n7️⃣ Nettoyage...')
    unsubscribeRefresh()
    unsubscribeExpired()
    
    if (window.indexedDBService) {
      await window.indexedDBService.delete('test-auto-refresh', 'test-key')
    }
    
    this.disableFastExpiration()
    testAutoRefreshLogger.log('✅ Nettoyage terminé\n')

    testAutoRefreshLogger.log('🧪 === TEST TERMINÉ ===')
    testAutoRefreshLogger.log('Vérifiez les logs ci-dessus pour confirmer que :')
    testAutoRefreshLogger.log('  1. Le refresh s\'est déclenché automatiquement à 25s')
    testAutoRefreshLogger.log('  2. La clé de chiffrement a été restaurée')
    testAutoRefreshLogger.log('  3. Les données sont toujours accessibles après refresh')
  },

  /**
   * Test du retry : simule 2 échecs puis succès
   */
  async runRetryTest() {
    testAutoRefreshLogger.log('🧪 === TEST RETRY AVEC BACKOFF ===\n')

    // 1. Préparer l'environnement
    testAutoRefreshLogger.log('1️⃣ Préparation...')
    if (!authStore.isAuthenticated) {
      testAutoRefreshLogger.log('   Connexion nécessaire...')
      await authStore.login('mock')
    }
    testAutoRefreshLogger.log('✅ Authentifié\n')

    // 2. Activer expiration rapide + échecs
    testAutoRefreshLogger.log('2️⃣ Configuration du test...')
    this.enableFastExpiration()
    this.enableRefreshFailure(2) // Les 2 premiers essais échoueront
    testAutoRefreshLogger.log('✅ Configuration :')
    testAutoRefreshLogger.log('   - Tokens expirent dans 30s')
    testAutoRefreshLogger.log('   - 2 premiers refresh échoueront')
    testAutoRefreshLogger.log('   - 3ème essai réussira\n')

    testAutoRefreshLogger.log('3️⃣ Attente du refresh (25s) + observation des retries...')
    testAutoRefreshLogger.log('   → Observez les logs pour voir :')
    testAutoRefreshLogger.log('      - Essai 1 : échec → backoff 2s')
    testAutoRefreshLogger.log('      - Essai 2 : échec → backoff 4s')
    testAutoRefreshLogger.log('      - Essai 3 : succès\n')

    // Attendre 45 secondes (assez pour les 3 tentatives)
    await new Promise(resolve => setTimeout(resolve, 45000))

    testAutoRefreshLogger.log('\n4️⃣ Vérification état final...')
    await this.inspectTokenState()

    testAutoRefreshLogger.log('\n🧪 === TEST RETRY TERMINÉ ===')
    testAutoRefreshLogger.log('Vérifiez que vous avez vu 3 tentatives dans les logs')
    
    this.disableFastExpiration()
  }
}

// Hook pour intercepter le MockProvider et modifier les tokens
if (typeof window !== 'undefined') {
  window.testAutoRefresh = testAutoRefresh
  
  // Intercepter les appels de login pour modifier expiresIn
  const originalFetch = window.fetch
  window.fetch = function(...args) {
    const result = originalFetch.apply(this, args)
    
    if (fastExpirationEnabled) {
      return result.then(async (response) => {
        // Si c'est une réponse JSON contenant un token
        const clonedResponse = response.clone()
        try {
          const data = await clonedResponse.json()
          
          if (data.access_token && data.expires_in) {
            testAutoRefreshLogger.log('🧪 [Intercept] Modification du token pour expiration rapide')
            testAutoRefreshLogger.log(`   Original: expires_in = ${data.expires_in}s`)
            testAutoRefreshLogger.log(`   Modifié:  expires_in = 30s`)
            
            // Créer une nouvelle réponse avec expires_in modifié
            const modifiedData = {
              ...data,
              expires_in: 30 // Force 30 secondes
            }
            
            return new Response(JSON.stringify(modifiedData), {
              status: response.status,
              statusText: response.statusText,
              headers: response.headers
            })
          }
        } catch (e) {
          // Pas du JSON ou autre erreur, retourner la réponse originale
        }
        
        return response
      })
    }
    
    // Mode normal : retourner tel quel
    return result
  }
  
  testAutoRefreshLogger.info('testAutoRefresh disponible dans window.testAutoRefresh')
  testAutoRefreshLogger.info('   Exemples :')
  testAutoRefreshLogger.info('   - testAutoRefresh.enableFastExpiration()')
  testAutoRefreshLogger.info('   - testAutoRefresh.runFullAutoRefreshTest()')
  testAutoRefreshLogger.info('   - testAutoRefresh.runRetryTest()')
  testAutoRefreshLogger.info('   - testAutoRefresh.inspectTokenState()')
}
