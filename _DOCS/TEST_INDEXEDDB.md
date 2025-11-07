# Script de Test: IndexedDB Chiffrée

Ce script permet de tester manuellement l'intégration complète de l'IndexedDB chiffrée.

## Étapes de Test

### 1. Démarrer l'Application

```bash
npm run dev
```

### 2. Ouvrir la Console du Navigateur

Appuyez sur F12 pour ouvrir les DevTools

### 3. Se Connecter

Cliquer sur le bouton de connexion (MockProvider par défaut en dev)

**Logs Attendus dans la Console :**
```
[auth] Deriving encryption key 
Object { appKey: "svelte-i...", userSub: "mock-dev...", derivationLength: ... }

[auth] Encryption key derived successfully 
Object { keyLength: 44, keyPreview: "..." }

[auth] Encryption key set 
Object { keyLength: 44 }

App: IndexedDB encryption key synchronized
```

### 4. Tester Sauvegarde de Données

Dans la console du navigateur :

**⚠️ Firefox uniquement** : Si vous voyez un avertissement sur le collage, tapez `allow pasting` dans la console et appuyez sur Entrée.

**💡 Raccourci** : Pour éviter de taper `window.indexedDBService` à chaque fois, créez un alias :
```javascript
const idb = window.indexedDBService
```

Ensuite, exécuter ligne par ligne (ou copier-coller après avoir activé le collage) :

```javascript
// Accéder au service
const { indexedDBService } = window

// Sauvegarder des données de test
await indexedDBService.save('default', 'test-data', {
  message: 'Hello IndexedDB!',
  timestamp: Date.now(),
  secret: 'This should be encrypted'
})

console.log('✅ Données sauvegardées')
```

**Alternative (sans copier-coller)** : Tapez directement dans la console en une ligne :
```javascript
await window.indexedDBService.save('default', 'test-data', { message: 'Hello IndexedDB!', timestamp: Date.now(), secret: 'This should be encrypted' })
```

### 5. Vérifier Chiffrement dans DevTools

1. Aller dans **Application > IndexedDB > svelte-ide-app-data > default**
2. Cliquer sur l'entrée `test-data`
3. Le champ `value` doit afficher du **base64 chiffré** (ex: `AQIDBAUGBwg...==`)
4. ❌ Si vous voyez du JSON en clair → le chiffrement n'est PAS actif

**Exemple de valeur chiffrée :**
```
AQIDBAUGBwgJCgsMDQ4PEBESExQVFhcYGRobHB0eHyAhIiMkJSYnKCkqKywtLi8=...
```

### 6. Tester Lecture de Données

```javascript
// Lire les données (déchiffrement automatique)
const data = await indexedDBService.load('default', 'test-data')
console.log('📖 Données lues:', data)

// Doit afficher :
// {
//   message: 'Hello IndexedDB!',
//   timestamp: 1699200000000,
//   secret: 'This should be encrypted'
// }
```

### 7. Tester Logout et Perte d'Accès

```javascript
// Récupérer authStore
const authStore = window.toolManager.authStore || 
                  (await import('/src/stores/authStore.svelte.js')).getAuthStore()

// Déconnecter
await authStore.logout()

console.log('🔓 Déconnecté')

// Essayer de lire les données
const dataAfterLogout = await indexedDBService.load('default', 'test-data')
console.log('📖 Données après logout:', dataAfterLogout)

// Doit afficher : null (déchiffrement échoue sans clé)
```

### 8. Tester Re-Connexion et Restauration

```javascript
// Reconnecter
await authStore.login('mock')

console.log('🔐 Reconnecté')

// Relire les données
const dataAfterLogin = await indexedDBService.load('default', 'test-data')
console.log('📖 Données après re-login:', dataAfterLogin)

// Doit afficher les données d'origine (déchiffrement réussi)
```

### 9. Tester Différents Stores

```javascript
// Sauvegarder dans le store 'tools'
await indexedDBService.save('tools', 'calculator-state', {
  lastResult: 42,
  history: [1, 2, 3]
})

// Compter les entrées
const count = await indexedDBService.count('default')
console.log(`📊 Nombre d'entrées dans 'default': ${count}`)

// Récupérer toutes les entrées
const allEntries = await indexedDBService.getAll('default')
console.log('📋 Toutes les entrées:', allEntries)
```

### 10. Tester Suppression

```javascript
// Supprimer une entrée
await indexedDBService.delete('default', 'test-data')

// Vérifier suppression
const deleted = await indexedDBService.load('default', 'test-data')
console.log('🗑️ Données supprimées:', deleted) // null

// Effacer tout le store
await indexedDBService.clear('default')
```

## Vérifications de Sécurité

### ✅ Checklist de Sécurité

- [ ] **Chiffrement au Repos** : Vérifier dans DevTools que `value` est du base64 chiffré
- [ ] **Déchiffrement Transparent** : `load()` retourne les données en clair
- [ ] **Perte d'Accès au Logout** : Après logout, `load()` retourne `null`
- [ ] **Restauration au Login** : Après re-login, les données sont de nouveau accessibles
- [ ] **Clé Unique par User** : Changer d'utilisateur change la clé (tester avec Google OAuth si disponible)
- [ ] **Erreurs Gérées** : Pas de crash si on tente de lire des données chiffrées avec mauvaise clé

### 🔍 Inspection de la Clé

```javascript
// NE JAMAIS FAIRE EN PRODUCTION (seulement pour debug)
const authStore = (await import('/src/stores/authStore.svelte.js')).getAuthStore()
console.log('🔑 Clé active:', authStore.encryptionKey?.substring(0, 8) + '...')
console.log('🔐 Clé présente:', authStore.hasEncryptionKey)
```

### 🧪 Test avec Vrais Providers OAuth

Si configuré avec Google ou Azure :

1. Se connecter avec votre compte Google
2. Vérifier que `userInfo.sub` est bien utilisé (console)
3. Sauvegarder des données
4. Se déconnecter COMPLÈTEMENT du navigateur (fermer tous les onglets)
5. Rouvrir l'application
6. Si auto-refresh fonctionne → données restaurées automatiquement
7. Si session expirée → re-login → données restaurées

## Problèmes Courants

### Données en Clair dans DevTools
**Cause** : Clé de chiffrement non définie
**Solution** : Vérifier que login génère bien la clé (check console logs)

### `load()` Retourne Toujours `null`
**Cause** : Mauvaise clé ou données corrompues
**Solution** : Effacer IndexedDB (DevTools > Application > Clear storage) et retester

### Erreur "IndexedDB not available"
**Cause** : Navigation privée ou navigateur incompatible
**Solution** : Utiliser un navigateur moderne en mode normal

### Auto-Refresh Ne Fonctionne Pas
**Cause** : Refresh token non configuré ou expiré
**Solution** : Vérifier `VITE_GOOGLE_CLIENT_ID` et permissions OAuth

## Résultats Attendus

✅ **Succès** : Données chiffrées au repos, déchiffrement transparent, perte/restauration fonctionnent
❌ **Échec** : Données en clair, erreurs de déchiffrement, crash au logout

## Prochaines Étapes

Si tous les tests passent :
1. Créer un outil exemple utilisant IndexedDB (`transactions-v2`)
2. Implémenter `IndexedDBPersister` pour `StateProviderService`
3. Améliorer auto-refresh OAuth avec retry
4. Ajouter documentation utilisateur
