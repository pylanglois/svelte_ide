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
import { getAuthStore } from '@/stores/authStore.svelte.js'

const authStore = getAuthStore()

export const testReAuth = {
  /**
   * Déclenche manuellement l'événement d'expiration de session
   */
  triggerExpiration(message = 'Test manuel : session expirée') {
    console.log('🧪 Test : déclenchement événement auth:session-expired')
    eventBus.publish('auth:session-expired', {
      message,
      timestamp: Date.now()
    })
  },

  /**
   * Force un refresh de token (utile pour tester le retry)
   */
  async forceRefresh() {
    console.log('🧪 Test : force refresh du token')
    try {
      const result = await authStore.refreshToken()
      console.log('✅ Refresh réussi:', result)
      return result
    } catch (error) {
      console.error('❌ Refresh échoué:', error)
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

    console.table(state)
    return state
  },

  /**
   * Teste le cycle complet : save → logout → reauth → load
   */
  async testFullCycle() {
    console.log('🧪 Test : cycle complet save/logout/reauth/load')

    // 1. Sauvegarder des données
    const testData = {
      secret: 'Données confidentielles',
      timestamp: Date.now()
    }

    console.log('1️⃣ Sauvegarde de données chiffrées...')
    await indexedDBService.save('test-reauth', 'cycle-test', testData)
    console.log('✅ Données sauvegardées:', testData)

    // 2. Se déconnecter
    console.log('2️⃣ Déconnexion...')
    await authStore.logout()
    console.log('✅ Déconnecté')

    // 3. Vérifier que les données ne sont plus accessibles
    console.log('3️⃣ Tentative de lecture sans clé...')
    try {
      await indexedDBService.load('test-reauth', 'cycle-test')
      console.warn('⚠️ Les données sont encore accessibles (pas normal)')
    } catch (error) {
      console.log('✅ Erreur attendue (pas de clé):', error.message)
    }

    // 4. Simuler l'expiration pour afficher le modal
    console.log('4️⃣ Déclenchement du modal de ré-auth...')
    this.triggerExpiration('Test cycle complet : veuillez vous reconnecter')

    console.log('👉 Authentifiez-vous via le modal, puis appelez testReAuth.verifyRestore()')
  },

  /**
   * Vérifie la restauration des données après ré-authentification
   */
  async verifyRestore() {
    console.log('🧪 Test : vérification de la restauration')

    if (!authStore.isAuthenticated) {
      console.error('❌ Vous devez être authentifié pour vérifier la restauration')
      return
    }

    if (!authStore.hasEncryptionKey) {
      console.error('❌ Pas de clé de chiffrement disponible')
      return
    }

    console.log('1️⃣ Lecture des données chiffrées...')
    const data = await indexedDBService.load('test-reauth', 'cycle-test')
    
    if (data && data.secret === 'Données confidentielles') {
      console.log('✅ SUCCÈS : Données restaurées correctement!', data)
      console.log('🎉 Le cycle complet fonctionne!')
    } else {
      console.error('❌ ÉCHEC : Données incorrectes ou manquantes', data)
    }

    // Nettoyage
    await indexedDBService.delete('test-reauth', 'cycle-test')
    console.log('🧹 Nettoyage effectué')
  },

  /**
   * Nettoie toutes les données de test
   */
  async cleanup() {
    console.log('🧹 Nettoyage des données de test...')
    await indexedDBService.clear('test-reauth')
    console.log('✅ Nettoyage terminé')
  }
}

// Exposer dans window pour les tests manuels
if (typeof window !== 'undefined') {
  window.testReAuth = testReAuth
  console.log('🧪 testReAuth disponible dans window.testReAuth')
  console.log('   Exemples :')
  console.log('   - testReAuth.triggerExpiration()')
  console.log('   - testReAuth.inspectState()')
  console.log('   - testReAuth.testFullCycle()')
}
