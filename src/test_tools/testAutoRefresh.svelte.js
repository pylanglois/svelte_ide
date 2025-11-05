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
import { getAuthStore } from '@/stores/authStore.svelte.js'

const authStore = getAuthStore()

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
    console.log('🧪 Mode expiration rapide ACTIVÉ')
    console.log('   → Les tokens expireront dans 30 secondes')
    console.log('   → Le refresh se déclenchera à 25 secondes')
    console.log('   → Reconnectez-vous pour appliquer')
  },

  /**
   * Désactive le mode expiration rapide (retour à 3600s)
   */
  disableFastExpiration() {
    fastExpirationEnabled = false
    refreshFailureCount = 0
    refreshAttemptCounter = 0
    console.log('🧪 Mode expiration rapide DÉSACTIVÉ')
    console.log('   → Les tokens retournent à leur durée normale')
  },

  /**
   * Force les N prochains refresh à échouer (pour tester le retry)
   */
  enableRefreshFailure(failureCount = 1) {
    refreshFailureCount = failureCount
    refreshAttemptCounter = 0
    console.log(`🧪 Échec de refresh ACTIVÉ : ${failureCount} tentative(s) échoueront`)
    console.log('   → Utilisé pour tester le retry avec backoff exponentiel')
  },

  /**
   * Hook appelé par MockProvider pour savoir s'il doit simuler un échec
   * (Exposé pour être accessible depuis window.testAutoRefresh)
   */
  shouldSimulateRefreshFailure() {
    if (refreshFailureCount > 0 && refreshAttemptCounter < refreshFailureCount) {
      refreshAttemptCounter++
      console.log(`🧪 [Simulate] Échec de refresh simulé (${refreshAttemptCounter}/${refreshFailureCount})`)
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

    console.log('🔍 État du Token et Auto-Refresh :')
    console.table(state)
    
    return state
  },

  /**
   * Démarre un test complet : login → attendre refresh → vérifier clé restaurée
   */
  async runFullAutoRefreshTest() {
    console.log('🧪 === TEST COMPLET AUTO-REFRESH ===\n')

    // 1. Vérifier l'état initial
    console.log('1️⃣ Vérification état initial...')
    if (authStore.isAuthenticated) {
      console.log('⚠️ Déjà authentifié. Déconnexion...')
      await authStore.logout()
      await new Promise(resolve => setTimeout(resolve, 500))
    }
    console.log('✅ Déconnecté\n')

    // 2. Activer le mode expiration rapide
    console.log('2️⃣ Activation mode expiration rapide (30s)...')
    this.enableFastExpiration()
    console.log('✅ Mode activé\n')

    // 3. Se connecter
    console.log('3️⃣ Connexion avec MockProvider...')
    const loginResult = await authStore.login('mock')
    if (!loginResult.success) {
      console.error('❌ Échec de connexion:', loginResult.error)
      return
    }
    console.log('✅ Connexion réussie')
    console.log('   Authenticated:', authStore.isAuthenticated)
    console.log('   User:', authStore.userInfo?.name)
    console.log('   Encryption Key:', authStore.encryptionKey?.substring(0, 20) + '...\n')

    // 4. Sauvegarder des données de test dans IndexedDB
    console.log('4️⃣ Sauvegarde de données de test...')
    const testData = {
      timestamp: Date.now(),
      message: 'Test auto-refresh',
      randomValue: Math.random()
    }
    
    if (window.indexedDBService) {
      await window.indexedDBService.save('test-auto-refresh', 'test-key', testData)
      console.log('✅ Données sauvegardées:', testData, '\n')
    } else {
      console.warn('⚠️ IndexedDB non initialisé (attendu si pas dans App.svelte)\n')
    }

    // 5. Attendre le refresh (25 secondes)
    console.log('5️⃣ Attente du refresh automatique (25 secondes)...')
    console.log('   → Observez les logs ci-dessous pour voir le refresh se déclencher\n')

    // Écouter l'événement de refresh réussi
    const unsubscribeRefresh = eventBus.subscribe('auth:token-refreshed', (data) => {
      console.log('🎉 TOKEN REFRESH RÉUSSI!')
      console.log('   Nouvelle encryption key:', authStore.encryptionKey?.substring(0, 20) + '...')
      console.log('   Timestamp:', new Date().toISOString())
    })

    // Écouter l'événement d'expiration
    const unsubscribeExpired = eventBus.subscribe('auth:session-expired', (data) => {
      console.error('❌ SESSION EXPIRÉE (tous les retries ont échoué)')
      console.error('   Message:', data.message)
    })

    // Attendre 35 secondes pour laisser le temps au refresh de se déclencher
    await new Promise(resolve => setTimeout(resolve, 35000))

    // 6. Vérifier que les données sont toujours accessibles
    console.log('\n6️⃣ Vérification de l\'accès aux données...')
    if (window.indexedDBService && authStore.hasEncryptionKey) {
      try {
        const loadedData = await window.indexedDBService.load('test-auto-refresh', 'test-key')
        
        if (loadedData && loadedData.message === testData.message) {
          console.log('✅ SUCCÈS : Données restaurées après refresh!')
          console.log('   Données:', loadedData)
        } else {
          console.error('❌ ÉCHEC : Données incorrectes')
          console.error('   Attendu:', testData)
          console.error('   Reçu:', loadedData)
        }
      } catch (error) {
        console.error('❌ ÉCHEC : Erreur lors de la lecture des données')
        console.error('   Erreur:', error.message)
      }
    } else {
      console.warn('⚠️ Impossible de vérifier les données (IndexedDB ou clé manquante)')
    }

    // 7. Nettoyage
    console.log('\n7️⃣ Nettoyage...')
    unsubscribeRefresh()
    unsubscribeExpired()
    
    if (window.indexedDBService) {
      await window.indexedDBService.delete('test-auto-refresh', 'test-key')
    }
    
    this.disableFastExpiration()
    console.log('✅ Nettoyage terminé\n')

    console.log('🧪 === TEST TERMINÉ ===')
    console.log('Vérifiez les logs ci-dessus pour confirmer que :')
    console.log('  1. Le refresh s\'est déclenché automatiquement à 25s')
    console.log('  2. La clé de chiffrement a été restaurée')
    console.log('  3. Les données sont toujours accessibles après refresh')
  },

  /**
   * Test du retry : simule 2 échecs puis succès
   */
  async runRetryTest() {
    console.log('🧪 === TEST RETRY AVEC BACKOFF ===\n')

    // 1. Préparer l'environnement
    console.log('1️⃣ Préparation...')
    if (!authStore.isAuthenticated) {
      console.log('   Connexion nécessaire...')
      await authStore.login('mock')
    }
    console.log('✅ Authentifié\n')

    // 2. Activer expiration rapide + échecs
    console.log('2️⃣ Configuration du test...')
    this.enableFastExpiration()
    this.enableRefreshFailure(2) // Les 2 premiers essais échoueront
    console.log('✅ Configuration :')
    console.log('   - Tokens expirent dans 30s')
    console.log('   - 2 premiers refresh échoueront')
    console.log('   - 3ème essai réussira\n')

    console.log('3️⃣ Attente du refresh (25s) + observation des retries...')
    console.log('   → Observez les logs pour voir :')
    console.log('      - Essai 1 : échec → backoff 2s')
    console.log('      - Essai 2 : échec → backoff 4s')
    console.log('      - Essai 3 : succès\n')

    // Attendre 45 secondes (assez pour les 3 tentatives)
    await new Promise(resolve => setTimeout(resolve, 45000))

    console.log('\n4️⃣ Vérification état final...')
    await this.inspectTokenState()

    console.log('\n🧪 === TEST RETRY TERMINÉ ===')
    console.log('Vérifiez que vous avez vu 3 tentatives dans les logs')
    
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
            console.log('🧪 [Intercept] Modification du token pour expiration rapide')
            console.log(`   Original: expires_in = ${data.expires_in}s`)
            console.log(`   Modifié:  expires_in = 30s`)
            
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
  
  console.log('🧪 testAutoRefresh disponible dans window.testAutoRefresh')
  console.log('   Exemples :')
  console.log('   - testAutoRefresh.enableFastExpiration()')
  console.log('   - testAutoRefresh.runFullAutoRefreshTest()')
  console.log('   - testAutoRefresh.runRetryTest()')
  console.log('   - testAutoRefresh.inspectTokenState()')
}
