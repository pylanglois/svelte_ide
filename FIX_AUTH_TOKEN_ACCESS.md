# Correctif : Accès aux Tokens dans authStore

## Problème Rencontré

Lors de l'exécution de `testAutoRefresh.runFullAutoRefreshTest()`, l'erreur suivante apparaissait :

```
Uncaught (in promise) TypeError: authStore.refreshToken.substring is not a function
```

## Cause

Les tokens (`accessToken`, `refreshToken`) ne sont **pas exposés directement** comme propriétés publiques de `authStore` pour des raisons de sécurité.

L'architecture suit le principe de moindre privilège :
- Les tokens sensibles sont encapsulés dans `AuthManager` et `TokenManager`
- Seule la méthode `getAccessToken()` permet d'y accéder
- Les composants et outils ne devraient pas manipuler les tokens directement

## Solution Appliquée

### Avant (❌ Incorrect)

```javascript
console.log('Access Token:', authStore.accessToken?.substring(0, 20) + '...')
console.log('Refresh Token:', authStore.refreshToken?.substring(0, 20) + '...')

const state = {
  hasAccessToken: !!authStore.accessToken,
  hasRefreshToken: !!authStore.refreshToken,
  // ...
}
```

### Après (✅ Correct)

```javascript
console.log('Authenticated:', authStore.isAuthenticated)
console.log('User:', authStore.userInfo?.name)
console.log('Encryption Key:', authStore.encryptionKey?.substring(0, 20) + '...')

const state = {
  isAuthenticated: authStore.isAuthenticated,
  hasEncryptionKey: authStore.hasEncryptionKey,
  userName: authStore.userInfo?.name,
  userSub: authStore.userInfo?.sub,
  // ...
}
```

## API Publique de authStore

### Propriétés Réactives Accessibles

| Propriété | Type | Description |
|-----------|------|-------------|
| `isAuthenticated` | `boolean` | État d'authentification |
| `userInfo` | `object \| null` | Informations utilisateur (sub, name, email, picture) |
| `availableProviders` | `array` | Liste des providers OAuth configurés |
| `isLoading` | `boolean` | Opération auth en cours |
| `error` | `string \| null` | Dernière erreur rencontrée |
| `initialized` | `boolean` | AuthStore initialisé |
| `initializationFailed` | `boolean` | Échec d'initialisation |
| `encryptionKey` | `string \| null` | Clé de chiffrement dérivée (44 caractères base64) |
| `hasEncryptionKey` | `boolean` | Présence de la clé (computed) |

### Méthodes Publiques

| Méthode | Signature | Description |
|---------|-----------|-------------|
| `login(providerId)` | `async (string) => Result` | Déclenche le flux OAuth |
| `logout()` | `async () => Result` | Déconnexion complète |
| `refreshToken()` | `async () => Result` | Refresh manuel du token |
| `getAccessToken()` | `() => string \| null` | Récupère le token actuel |
| `setEncryptionKey(key)` | `(string) => void` | Définit la clé de chiffrement |
| `clearEncryptionKey()` | `() => void` | Efface la clé de chiffrement |
| `clearError()` | `() => void` | Réinitialise l'erreur |

### Propriétés Non Exposées (Internes)

Ces propriétés sont **intentionnellement privées** :

- ❌ `accessToken` (géré par TokenManager)
- ❌ `refreshToken` (géré par TokenManager)
- ❌ `tokenExpiry` (géré par TokenManager)

**Pourquoi ?**
- **Sécurité** : Éviter l'accès direct aux tokens sensibles
- **Encapsulation** : La gestion des tokens est la responsabilité d'AuthManager
- **Intégrité** : Les tokens ne doivent pas être modifiés par les composants

## Pour les Développeurs d'Outils

### ✅ Bonnes Pratiques

```javascript
// Vérifier l'authentification
if (authStore.isAuthenticated) {
  // Utilisateur connecté
}

// Accéder aux infos utilisateur
const userName = authStore.userInfo?.name
const userEmail = authStore.userInfo?.email

// Vérifier la clé de chiffrement
if (authStore.hasEncryptionKey) {
  // IndexedDB peut chiffrer/déchiffrer
}

// Déclencher un refresh manuel si nécessaire
await authStore.refreshToken()
```

### ❌ Anti-Patterns

```javascript
// NE PAS FAIRE : accès direct au token
const token = authStore.accessToken // undefined

// NE PAS FAIRE : vérification via substring
if (authStore.refreshToken?.startsWith('mock_')) // TypeError

// NE PAS FAIRE : manipulation directe des tokens
authStore.accessToken = 'custom_token' // Propriété non existante
```

### ✅ Alternative pour Récupérer le Token (Usage Avancé)

Si vous avez **vraiment besoin** du token (ex: appel API personnalisé) :

```javascript
const token = authStore.getAccessToken()

if (token) {
  fetch('/api/protected', {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  })
}
```

**Note** : Pour la plupart des cas, utilisez `isAuthenticated` au lieu d'accéder au token.

## Implications pour les Tests

### Tests avec testAutoRefresh

Les tests ne peuvent **pas vérifier directement** la présence des tokens, mais peuvent valider :

✅ **Ce qui est testable** :
- `isAuthenticated` → confirme qu'un token existe
- `hasEncryptionKey` → confirme que la clé est dérivée (donc login réussi)
- `userInfo` → confirme que les données utilisateur sont disponibles
- Appels API réussis → confirme que le token est valide et utilisé

❌ **Ce qui n'est pas testable directement** :
- Contenu exact du token (chiffré et caché)
- Date d'expiration précise (gérée en interne)
- Présence du refresh token (géré en interne)

### Exemple de Test Adapté

```javascript
// Avant (tentait d'accéder aux tokens)
const hasToken = !!authStore.accessToken

// Après (utilise les propriétés publiques)
const hasToken = authStore.isAuthenticated
const canEncrypt = authStore.hasEncryptionKey
const user = authStore.userInfo
```

## Migration des Tests Existants

Si vous avez du code qui référence `authStore.accessToken` ou `authStore.refreshToken`, remplacez par :

```javascript
// Remplacement 1 : Vérification de présence
- if (authStore.accessToken) {
+ if (authStore.isAuthenticated) {

// Remplacement 2 : Logs de débogage
- console.log('Token:', authStore.accessToken)
+ console.log('Authenticated:', authStore.isAuthenticated)
+ console.log('User:', authStore.userInfo?.name)

// Remplacement 3 : Récupération pour usage
- const token = authStore.accessToken
+ const token = authStore.getAccessToken()
```

## Références

- **Fichier Source** : `src/stores/authStore.svelte.js`
- **Documentation** : `_GUIDES/ARCHITECTURE.md` (section AuthManager)
- **Principe** : Least Privilege Access (moindre privilège)

---

**Date** : 2025-11-05  
**Correctif** : Sprint 2 - Tests Auto-Refresh  
**Impact** : `testAutoRefresh.svelte.js`, `TEST_AUTO_REFRESH.md`
