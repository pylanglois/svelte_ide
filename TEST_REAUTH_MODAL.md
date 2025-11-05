# Test du Modal de Ré-authentification

Ce guide décrit comment tester le flux de ré-authentification automatique après expiration de session.

## Prérequis

1. Serveur de développement démarré (`npm run dev`)
2. Console navigateur ouverte (F12)
3. Utilisateur authentifié avec `MockProvider`

## Étape 1 : Simuler une expiration de session

### Option A : Via la console du navigateur

```javascript
// Publier l'événement d'expiration manuellement
window.eventBus.publish('auth:session-expired', {
  message: 'Test manuel : session expirée',
  timestamp: Date.now()
})
```

### Option B : Modifier le TokenManager pour des tokens de courte durée

Dans `src/core/auth/TokenManager.svelte.js`, ligne ~200 (méthode `setupAutoRefresh`), réduire temporairement le délai :

```javascript
// TEMPORAIRE pour le test - réduire à 10 secondes
const refreshDelay = 10000 // au lieu de : (expiresIn - this.refreshBufferSeconds) * 1000
```

Puis attendre 10 secondes après le login.

## Étape 2 : Vérifier l'affichage du modal

**Comportement attendu** :
1. Le modal apparaît avec :
   - Titre : "⏱️ Session Expirée"
   - Message : "Votre session a expiré. Veuillez vous reconnecter pour continuer."
   - Liste des providers disponibles (MockProvider visible)
   - Bouton "Annuler"

2. L'écran est assombri avec un `backdrop-filter: blur(4px)`

3. Le modal est centré, avec animation `slideIn`

**Vérifications** :
- [ ] Le modal est visible
- [ ] Le backdrop bloque l'interaction avec l'IDE
- [ ] Le message est clair
- [ ] Les providers sont listés correctement

## Étape 3 : Tester la ré-authentification réussie

1. Cliquer sur le bouton "MockProvider" dans le modal

**Comportement attendu** :
1. Le bouton devient désactivé (`isReauthenticating = true`)
2. Le login se déclenche automatiquement
3. Si succès :
   - Le modal se ferme
   - L'utilisateur est à nouveau authentifié
   - La clé de chiffrement est restaurée dans `authStore`
   - Notification de succès dans `ideStore`

**Vérifications dans la console** :
```javascript
// Vérifier que la clé est restaurée
console.log('Encryption key:', window.authStore.encryptionKey)
console.log('Has key:', window.authStore.hasEncryptionKey)

// Vérifier que l'utilisateur est authentifié
console.log('User:', window.authStore.userInfo)
console.log('Is authenticated:', window.authStore.isAuthenticated)
```

**Checklist** :
- [ ] Le modal se ferme automatiquement
- [ ] `authStore.encryptionKey` est défini
- [ ] `authStore.isAuthenticated === true`
- [ ] Les données IndexedDB sont à nouveau accessibles

## Étape 4 : Tester l'annulation

1. Publier l'événement d'expiration :
```javascript
window.eventBus.publish('auth:session-expired', {})
```

2. Cliquer sur le bouton "Annuler"

**Comportement attendu** :
- Le modal se ferme
- L'utilisateur reste déconnecté
- Pas de ré-authentification

**Checklist** :
- [ ] Le modal se ferme
- [ ] `authStore.isAuthenticated === false`
- [ ] Pas de nouvelle requête OAuth

## Étape 5 : Tester la gestion d'erreur

1. Modifier temporairement `MockProvider` pour forcer un échec :

```javascript
// Dans src/core/auth/providers/MockProvider.svelte.js, méthode login()
async login() {
  throw new Error('Test : échec de connexion')
}
```

2. Publier l'événement d'expiration :
```javascript
window.eventBus.publish('auth:session-expired', {})
```

3. Cliquer sur "MockProvider"

**Comportement attendu** :
1. Le modal reste ouvert
2. Un message d'erreur s'affiche :
   - Background rouge (`--vscode-inputValidation-errorBackground`)
   - Icône ⚠️
   - Texte : "Test : échec de connexion"
3. Le bouton redevient cliquable

**Checklist** :
- [ ] Le modal reste ouvert après l'erreur
- [ ] Le message d'erreur est affiché
- [ ] Il est possible de réessayer

## Étape 6 : Tester le flux auto-refresh avec retry

1. Restaurer le code normal du `MockProvider`

2. Modifier `TokenManager` pour simuler un échec puis un succès :

```javascript
// Dans attemptRefreshWithRetry(), forcer un échec sur le 1er essai
if (attempt === 0) {
  throw new Error('Test : premier essai échoue')
}
```

3. Attendre l'auto-refresh (après 5min en production, ou 10s si modifié)

**Comportement attendu** :
1. Le premier essai échoue (log dans console)
2. Délai de 2 secondes (backoff)
3. Le deuxième essai réussit
4. La session est prolongée sans modal
5. Pas d'interruption pour l'utilisateur

**Vérifications console** :
```
Auto-refresh tenté (1/3)
Échec refresh : Test : premier essai échoue
Attente avant retry : 2000ms
Auto-refresh tenté (2/3)
Token rafraîchi avec succès
```

**Checklist** :
- [ ] Le retry fonctionne automatiquement
- [ ] Les délais de backoff sont respectés (2s, 4s, 8s)
- [ ] Le modal n'apparaît qu'après 3 échecs
- [ ] L'utilisateur n'est pas interrompu si le retry réussit

## Étape 7 : Tester l'intégration avec IndexedDB

1. Insérer des données chiffrées :
```javascript
await window.indexedDBService.save('test-store', 'key1', { secret: 'data' })
```

2. Se déconnecter :
```javascript
await window.authStore.logout()
```

3. Publier l'événement d'expiration :
```javascript
window.eventBus.publish('auth:session-expired', {})
```

4. Se ré-authentifier via le modal

5. Relire les données :
```javascript
const data = await window.indexedDBService.load('test-store', 'key1')
console.log('Données restaurées:', data)
```

**Comportement attendu** :
- Les données sont correctement déchiffrées après ré-authentification
- Aucune erreur de déchiffrement
- Le contenu correspond exactement à ce qui a été sauvegardé

**Checklist** :
- [ ] Les données sont restaurées correctement
- [ ] Aucune erreur dans la console
- [ ] Le flux login → encryption key → déchiffrement fonctionne

## Étape 8 : Tester le clic sur backdrop

1. Publier l'événement d'expiration
2. Cliquer à l'extérieur du modal (sur la zone sombre)

**Comportement attendu** :
- Le modal se ferme
- Équivalent à "Annuler"

**Checklist** :
- [ ] Le clic sur backdrop ferme le modal
- [ ] L'utilisateur reste déconnecté

## Résumé des Critères de Succès

✅ **Modal** :
- Apparaît sur événement `auth:session-expired`
- Affiche les providers disponibles
- Gère les états loading/error/success
- Se ferme sur annulation ou succès

✅ **Retry automatique** :
- 3 tentatives avec backoff exponentiel (2s, 4s, 8s)
- Logs clairs dans la console
- Modal affiché uniquement si 3 échecs

✅ **Intégration** :
- La clé de chiffrement est restaurée
- Les données IndexedDB sont accessibles
- Pas de perte de données après ré-auth

✅ **UX** :
- Animation fluide
- Messages d'erreur clairs
- Pas d'interruption si l'auto-refresh réussit
- L'utilisateur peut annuler ou réessayer

## Nettoyage après les tests

Retirer les modifications temporaires :
- Restaurer `TokenManager.setupAutoRefresh()` (délai normal)
- Restaurer `MockProvider.login()` (comportement normal)
- Vider IndexedDB si nécessaire :
```javascript
await window.indexedDBService.clear('test-store')
```
