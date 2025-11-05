# Test Auto-Refresh avec Expiration Rapide

Ce guide décrit comment tester le mécanisme d'auto-refresh OAuth avec des tokens de courte durée (30s) pour valider le timing, le retry et la restauration de la clé de chiffrement.

## Objectif

Valider que :
1. Le refresh se déclenche automatiquement **5 secondes avant** l'expiration
2. Le système effectue **3 tentatives avec backoff exponentiel** (2s, 4s, 8s) en cas d'échec
3. La **clé de chiffrement est restaurée** après un refresh réussi
4. Le **modal de ré-auth s'affiche** après 3 échecs
5. Les **données IndexedDB restent accessibles** après refresh

---

## Prérequis

1. Serveur de développement démarré (`npm run dev`)
2. Console navigateur ouverte (F12)
3. **Onglet Console** visible pour observer les logs
4. Application chargée dans le navigateur

---

## Test 1 : Auto-Refresh avec Succès (Timing)

### Objectif
Vérifier que le refresh se déclenche exactement 5 secondes avant l'expiration du token.

### Étapes

1. **Ouvrir la console et activer le mode test**
   ```javascript
   testAutoRefresh.enableFastExpiration()
   ```
   
   **Sortie attendue :**
   ```
   🧪 Mode expiration rapide ACTIVÉ
      → Les tokens expireront dans 30 secondes
      → Le refresh se déclenchera à 25 secondes
      → Reconnectez-vous pour appliquer
   ```

2. **Se connecter avec MockProvider**
   ```javascript
   await authStore.login('mock')
   ```
   
   **Sortie attendue :**
   ```
   [AuthManager] Login successful
   [EncryptionKey] Clé de chiffrement dérivée : abcd...wxyz (44 caractères)
   ```

3. **Observer la console pendant 30 secondes**
   
   **À t=0s (immédiatement après login) :**
   ```
   [TokenManager] Auto-refresh programmé dans 25000ms (25 secondes)
   ```
   
   **À t=25s (refresh automatique) :**
   ```
   [TokenManager] Auto-refresh déclenché
   [TokenManager] Auto-refresh tenté (1/3)
   [MockProvider] Mock provider refreshing token
   [MockProvider] Mock provider token refresh successful
   [TokenManager] Token rafraîchi avec succès
   [EncryptionKey] Clé de chiffrement restaurée après refresh
   [TokenManager] Auto-refresh programmé dans 25000ms (25 secondes)
   ```

4. **Vérifier l'état après refresh**
   ```javascript
   testAutoRefresh.inspectTokenState()
   ```
   
   **Sortie attendue :**
   ```
   🔍 État du Token et Auto-Refresh :
   ┌───────────────────────────────┬─────────────────┐
   │ isAuthenticated               │ true            │
   │ hasEncryptionKey              │ true            │
   │ encryptionKeyLength           │ 44              │
   │ userName                      │ John Doe        │
   │ userSub                       │ mock-user-123   │
   │ fastExpirationMode            │ true            │
   │ tokenWillExpireInSeconds      │ 30              │
   │ refreshWillTriggerAtSeconds   │ 25              │
   └───────────────────────────────┴─────────────────┘
   ```

5. **Désactiver le mode test**
   ```javascript
   testAutoRefresh.disableFastExpiration()
   ```

### ✅ Critères de Succès

- [ ] Le refresh se déclenche exactement à 25 secondes (±1s de tolérance)
- [ ] Aucune erreur dans la console
- [ ] La clé de chiffrement reste valide après refresh (`hasEncryptionKey = true`)
- [ ] Un nouveau refresh est programmé automatiquement après succès

---

## Test 2 : Retry avec Backoff Exponentiel

### Objectif
Valider que le système réessaie 3 fois avec des délais croissants (2s, 4s, 8s) en cas d'échec.

### Étapes

1. **Configurer le test pour simuler 2 échecs**
   ```javascript
   testAutoRefresh.enableFastExpiration()
   testAutoRefresh.enableRefreshFailure(2) // Les 2 premiers échoueront
   ```
   
   **Sortie attendue :**
   ```
   🧪 Mode expiration rapide ACTIVÉ
   🧪 Échec de refresh ACTIVÉ : 2 tentative(s) échoueront
   ```

2. **Se connecter**
   ```javascript
   await authStore.login('mock')
   ```

3. **Observer la séquence complète (environ 40 secondes)**
   
   **À t=25s (1ère tentative - ÉCHEC) :**
   ```
   [TokenManager] Auto-refresh déclenché
   [TokenManager] Auto-refresh tenté (1/3)
   🧪 [Simulate] Échec de refresh simulé (1/2)
   [MockProvider] Mock provider simulating refresh failure (test mode)
   [TokenManager] Échec refresh : Simulated refresh failure for testing
   [TokenManager] Attente avant retry : 2000ms
   ```
   
   **À t=27s (2ème tentative - ÉCHEC) :**
   ```
   [TokenManager] Auto-refresh tenté (2/3)
   🧪 [Simulate] Échec de refresh simulé (2/2)
   [MockProvider] Mock provider simulating refresh failure (test mode)
   [TokenManager] Échec refresh : Simulated refresh failure for testing
   [TokenManager] Attente avant retry : 4000ms
   ```
   
   **À t=31s (3ème tentative - SUCCÈS) :**
   ```
   [TokenManager] Auto-refresh tenté (3/3)
   [MockProvider] Mock provider refreshing token
   [MockProvider] Mock provider token refresh successful
   [TokenManager] Token rafraîchi avec succès
   ```

4. **Vérifier l'état final**
   ```javascript
   testAutoRefresh.inspectTokenState()
   ```
   
   **Sortie attendue :**
   ```
   │ isAuthenticated               │ true            │
   │ hasEncryptionKey              │ true            │
   │ simulatedFailuresRemaining    │ 0               │
   │ totalRefreshAttempts          │ 2               │
   ```

5. **Nettoyer**
   ```javascript
   testAutoRefresh.disableFastExpiration()
   ```

### ✅ Critères de Succès

- [ ] 3 tentatives de refresh observées dans les logs
- [ ] Délais respectés : 2s après échec #1, 4s après échec #2
- [ ] Le 3ème essai réussit (aucun échec simulé restant)
- [ ] La session reste active (pas de modal de ré-auth)
- [ ] La clé de chiffrement est préservée

---

## Test 3 : Expiration Définitive (3 Échecs)

### Objectif
Vérifier que le modal de ré-auth s'affiche après 3 échecs consécutifs.

### Étapes

1. **Configurer le test pour 3 échecs**
   ```javascript
   testAutoRefresh.enableFastExpiration()
   testAutoRefresh.enableRefreshFailure(3) // Tous les essais échoueront
   ```

2. **Se connecter**
   ```javascript
   await authStore.login('mock')
   ```

3. **Observer la séquence (environ 42 secondes)**
   
   **À t=25s :** Tentative 1 → Échec → Attente 2s  
   **À t=27s :** Tentative 2 → Échec → Attente 4s  
   **À t=31s :** Tentative 3 → Échec → Session expirée  
   
   **Après t=31s :**
   ```
   [TokenManager] Tous les essais de refresh ont échoué
   [TokenManager] Appel de handleExpiredSession()
   [AuthManager] Session expirée après échec refresh
   [EncryptionKey] Clé de chiffrement effacée
   [EventBus] Événement publié : auth:session-expired
   ```

4. **Vérifier l'affichage du modal**
   
   **UI attendue :**
   - Modal centré avec titre "⏱️ Session Expirée"
   - Message : "Votre session a expiré. Veuillez vous reconnecter pour continuer."
   - Liste des providers (MockProvider visible)
   - Backdrop sombre avec blur

5. **Vérifier l'état**
   ```javascript
   testAutoRefresh.inspectTokenState()
   ```
   
   **Sortie attendue :**
   ```
   │ isAuthenticated               │ false           │
   │ hasEncryptionKey              │ false           │
   │ simulatedFailuresRemaining    │ 0               │
   │ totalRefreshAttempts          │ 3               │
   ```

6. **Se ré-authentifier via le modal**
   - Cliquer sur "MockProvider" dans le modal
   - Vérifier que le modal se ferme
   - Vérifier que la clé est restaurée

7. **Nettoyer**
   ```javascript
   testAutoRefresh.disableFastExpiration()
   ```

### ✅ Critères de Succès

- [ ] Modal de ré-auth s'affiche après le 3ème échec
- [ ] Notification persistante affichée ("Session expirée")
- [ ] Clé de chiffrement effacée (`hasEncryptionKey = false`)
- [ ] Re-login via modal restaure la clé
- [ ] Les données IndexedDB deviennent à nouveau accessibles

---

## Test 4 : Cycle Complet avec Données IndexedDB

### Objectif
Vérifier que les données persistent et restent accessibles après un refresh automatique.

### Étapes

1. **Lancer le test complet automatisé**
   ```javascript
   await testAutoRefresh.runFullAutoRefreshTest()
   ```
   
   Ce script effectue automatiquement :
   1. Activation du mode expiration rapide
   2. Login
   3. Sauvegarde de données de test dans IndexedDB
   4. Attente du refresh automatique (35 secondes)
   5. Vérification que les données sont toujours accessibles
   6. Nettoyage

2. **Observer les logs pendant 40 secondes**
   
   **Sortie attendue (résumé) :**
   ```
   🧪 === TEST COMPLET AUTO-REFRESH ===
   
   1️⃣ Vérification état initial...
   ✅ Déconnecté
   
   2️⃣ Activation mode expiration rapide (30s)...
   ✅ Mode activé
   
   3️⃣ Connexion avec MockProvider...
   ✅ Connexion réussie
      Access Token: mock_access_token_...
      Encryption Key: Rgby...H8== (44 chars)
   
   4️⃣ Sauvegarde de données de test...
   ✅ Données sauvegardées: {
     timestamp: 1699200000000,
     message: 'Test auto-refresh',
     randomValue: 0.42
   }
   
   5️⃣ Attente du refresh automatique (25 secondes)...
   
   [... 25 secondes plus tard ...]
   
   🎉 TOKEN REFRESH RÉUSSI!
      Nouvelle encryption key: Rgby...H8==
      Timestamp: 2025-11-05T...
   
   6️⃣ Vérification de l'accès aux données...
   ✅ SUCCÈS : Données restaurées après refresh!
      Données: {
        timestamp: 1699200000000,
        message: 'Test auto-refresh',
        randomValue: 0.42
      }
   
   7️⃣ Nettoyage...
   ✅ Nettoyage terminé
   
   🧪 === TEST TERMINÉ ===
   ```

### ✅ Critères de Succès

- [ ] Données sauvegardées avant refresh
- [ ] Refresh se déclenche automatiquement
- [ ] Clé de chiffrement restaurée
- [ ] Données correctement déchiffrées après refresh
- [ ] Valeurs identiques avant et après refresh

---

## Test 5 : Retry avec Échecs Multiples

### Objectif
Tester le scénario 2 échecs → succès automatiquement.

### Étapes

1. **Lancer le test automatisé du retry**
   ```javascript
   await testAutoRefresh.runRetryTest()
   ```

2. **Observer la sortie (environ 45 secondes)**
   
   **Sortie attendue :**
   ```
   🧪 === TEST RETRY AVEC BACKOFF ===
   
   1️⃣ Préparation...
   ✅ Authentifié
   
   2️⃣ Configuration du test...
   ✅ Configuration :
      - Tokens expirent dans 30s
      - 2 premiers refresh échoueront
      - 3ème essai réussira
   
   3️⃣ Attente du refresh (25s) + observation des retries...
   
   [... logs de retry ...]
   
   4️⃣ Vérification état final...
   │ isAuthenticated               │ true            │
   │ hasEncryptionKey              │ true            │
   
   🧪 === TEST RETRY TERMINÉ ===
   ```

### ✅ Critères de Succès

- [ ] 3 tentatives visibles dans les logs
- [ ] État final : authentifié avec clé valide
- [ ] Pas d'interruption pour l'utilisateur

---

## Dépannage

### Problème : Le refresh ne se déclenche pas

**Cause possible :** Mode expiration rapide non activé avant le login

**Solution :**
```javascript
testAutoRefresh.disableFastExpiration()
await authStore.logout()
testAutoRefresh.enableFastExpiration()
await authStore.login('mock')
```

---

### Problème : "IndexedDB non initialisé"

**Cause possible :** Script exécuté avant le montage complet de `App.svelte`

**Solution :**
```javascript
// Vérifier que IndexedDB est prêt
console.log('IndexedDB ready:', window.indexedDBService?.isInitialized)

// Si false, attendre quelques secondes et réessayer
```

---

### Problème : Les échecs simulés ne fonctionnent pas

**Cause possible :** `enableRefreshFailure()` appelé après le login

**Solution :**
```javascript
// L'ordre est important :
testAutoRefresh.enableFastExpiration()
testAutoRefresh.enableRefreshFailure(2)  // AVANT le login
await authStore.login('mock')
```

---

## Checklist Complète

### Timing
- [ ] Refresh se déclenche à t=25s (token de 30s)
- [ ] Nouveau refresh programmé après succès

### Retry
- [ ] 1er échec → délai 2s
- [ ] 2ème échec → délai 4s
- [ ] 3ème échec → session expirée

### Clé de Chiffrement
- [ ] Clé dérivée au login
- [ ] Clé restaurée après refresh
- [ ] Clé effacée après 3 échecs
- [ ] Clé restaurée après re-login via modal

### IndexedDB
- [ ] Données sauvegardées avec chiffrement
- [ ] Données accessibles après refresh
- [ ] Erreur de déchiffrement si clé manquante

### UX
- [ ] Aucune interruption si retry réussit
- [ ] Modal affiché après 3 échecs
- [ ] Notification persistante visible
- [ ] Re-login via modal fonctionne

---

## Nettoyage Final

Après tous les tests :

```javascript
// Désactiver tous les modes de test
testAutoRefresh.disableFastExpiration()

// Se déconnecter
await authStore.logout()

// Nettoyer IndexedDB
await window.indexedDBService.clear('test-auto-refresh')

// Recharger la page pour état propre
location.reload()
```

---

**Auteur** : Tests Auto-Refresh OAuth  
**Date** : 2025-11-05  
**Versions** : Sprint 2 - Tâche #3.4
