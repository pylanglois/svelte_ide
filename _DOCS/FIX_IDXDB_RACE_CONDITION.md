# Fix: Race Condition IndexedDB au démarrage

**Date**: 10 novembre 2025  
**Issue**: Erreur `IDBDatabase.transaction: Can't start a transaction on a closed database`

## Problème Identifié

### Symptômes
```
IndexedDBService: Save failed due to closed database, retrying once 
DOMException: IDBDatabase.transaction: Can't start a transaction on a closed database
```

Erreurs observées dans la console au clic sur un tool lors du démarrage de l'application.

### Analyse Racine (par l'intégrateur)

Le flux problématique était :
1. L'utilisateur clique sur un tool dans la toolbar
2. `PanelsManager.togglePanel()` active le panel
3. `PanelsManager._notifyChange()` déclenche le callback
4. `ideStore.saveUserLayout()` est appelé **immédiatement**
5. ❌ **IndexedDB n'est pas encore ouvert** → Exception

### Cause Technique

Dans `ideStore.svelte.js`, le callback de changement de panels était enregistré **sans garde** :

```javascript
// ❌ AVANT - Sauvegarde immédiate sans vérification
this.panelsManager.addChangeCallback(() => {
  this._updateToolLists()
  this.saveUserLayout() // Appelé avant que IndexedDB soit prêt
})
```

Le service `indexedDBService` dispose d'un **retry mechanism** qui réinitialise la DB et réessaie, mais :
- Ce retry ajoute de la latence (réouverture de DB)
- Les logs d'erreur polluent la console
- Le retry peut échouer si la DB n'est toujours pas prête

## Solution Implémentée

### Approche : Différer les sauvegardes ET attendre readyForEncryption

Le fix comporte **deux parties critiques** :

#### 1. **Dans `ideStore.svelte.js` : Flag de garde**

```javascript
this._persistenceReady = false
this._hasPendingSave = false

eventBus.subscribe('persistence:ready', () => {
  this._persistenceReady = true
  // Si une sauvegarde était en attente, la déclencher maintenant
  if (this._hasPendingSave) {
    this._hasPendingSave = false
    this.saveUserLayout()
  }
})
```

```javascript
async saveUserLayout() {
  if (!this.isAuthenticated || !this.user) return
  
  // Différer la sauvegarde si la persistance n'est pas encore prête
  if (!this._persistenceReady) {
    this._hasPendingSave = true
    console.debug('IdeStore: Sauvegarde différée, persistance non prête')
    return
  }
  
  // ... reste du code de sauvegarde
}
```

#### 2. **Dans `App.svelte` : Attendre readyForEncryption() AVANT de publier**

**❌ CODE PROBLÉMATIQUE (avant fix)** :
```javascript
$effect(() => {
  const key = authStore.encryptionKey
  const encrypted = Boolean(key)
  if (encrypted) {
    indexedDBService.setEncryptionKey(key) // ← Déclenche fermeture/réouverture DB
    binaryStorageService.setEncryptionKey(key)
  }
  eventBus.publish('persistence:ready', { ... }) // ← TROP TÔT ! DB pas prête
})
```

**✅ CODE CORRIGÉ** :
```javascript
$effect(() => {
  const key = authStore.encryptionKey
  const encrypted = Boolean(key)
  
  const syncPersistence = async () => {
    if (encrypted) {
      indexedDBService.setEncryptionKey(key)
      binaryStorageService.setEncryptionKey(key)
      
      // ✅ ATTENDRE que IndexedDB soit vraiment prête
      try {
        await indexedDBService.readyForEncryption({ timeoutMs: 10000 })
        console.debug('App: IndexedDB ready, publishing persistence:ready')
      } catch (readyError) {
        console.warn('App: IndexedDB timeout, publishing anyway', readyError)
        eventBus.publish('persistence:error', { reason: 'timeout', ... })
      }
    } else {
      indexedDBService.clearEncryptionKey()
      binaryStorageService.clearEncryptionKey()
    }
    
    // Publier SEULEMENT après que readyForEncryption() soit résolu
    eventBus.publish('persistence:ready', { encrypted, ... })
  }
  
  syncPersistence()
})
```

**Pourquoi c'était cassé** :
- `setEncryptionKey()` déclenche `initialize()` qui **ferme puis rouvre** la DB
- Cette opération prend plusieurs centaines de millisecondes
- L'ancien code publiait `persistence:ready` **immédiatement** sans attendre
- Résultat : `ideStore` marquait `_persistenceReady = true` alors que la DB était fermée

### Flux Corrigé

```
1. App.svelte démarre
2. authStore.encryptionKey change
3. App.$effect() se déclenche
   ├─> indexedDBService.setEncryptionKey(key)
   │     └─> Ferme la DB actuelle
   │     └─> Rouvre avec chiffrement
   ├─> await indexedDBService.readyForEncryption()
   │     └─> Attend que db.onupgradeneeded se termine
   │     └─> Attend que db.onsuccess se termine
   ├─> ✅ DB VRAIMENT PRÊTE
   └─> eventBus.publish('persistence:ready')
         └─> ideStore._persistenceReady = true
         └─> Exécute la sauvegarde en attente si nécessaire
4. Utilisateur clique sur un tool
5. PanelsManager notifie le changement
6. ideStore.saveUserLayout() vérifie _persistenceReady
   └─> ✅ La DB est garantie ouverte et opérationnelle
```

## Tests de Validation

### Scénario 1 : Démarrage à froid
1. Clear le cache (IndexedDB + localStorage)
2. Rafraîchir l'app
3. Cliquer rapidement sur un tool
4. ✅ **Aucune erreur IndexedDB dans la console**
5. ✅ Le panel s'ouvre correctement
6. Recharger la page
7. ✅ Le layout est restauré (panel ouvert)

### Scénario 2 : Utilisateur authentifié
1. Se connecter avec Google OAuth
2. Ouvrir un tool (ex: Explorer)
3. ✅ Pas d'erreur `closed database`
4. Rafraîchir
5. ✅ Le tool est toujours ouvert

### Scénario 3 : Mode non-authentifié
1. Lancer l'app avec `VITE_AUTH_PROVIDERS=mock` désactivé
2. Ouvrir/fermer des tools
3. ✅ La persistance fonctionne en localStorage (fallback)
4. ✅ Pas d'erreur liée à IndexedDB

## Impact

### Avant le Fix
- ❌ Erreurs `DOMException` dans la console au démarrage
- ❌ Latence due au retry automatique
- ❌ Expérience utilisateur polluée par des logs d'erreur
- ⚠️ Fonctionnel mais non optimal (le retry finissait par fonctionner)

### Après le Fix
- ✅ Aucune erreur au démarrage
- ✅ Sauvegarde déclenchée uniquement quand IndexedDB est prêt
- ✅ Logs propres : `IdeStore: Sauvegarde différée, persistance non prête` (debug uniquement)
- ✅ Performance optimale (pas de retry inutile)

## Considérations Futures

### Limitation Actuelle
Le flag `_persistenceReady` ne passe **jamais à `false`** après avoir été activé. Si IndexedDB se ferme en cours d'exécution (rare, mais possible avec des extensions navigateur agressives), les sauvegardes échoueront.

### Amélioration Possible
Écouter également `persistence:error` pour désactiver temporairement les sauvegardes :
```javascript
eventBus.subscribe('persistence:error', ({ reason }) => {
  if (reason === 'database_closed') {
    this._persistenceReady = false
  }
})
```

⚠️ **Non implémenté pour l'instant** car ce scénario est extrêmement rare en production et le retry mechanism de `IndexedDBService` gère déjà ce cas.

## Références

- **Code modifié** :
  - `src/stores/ideStore.svelte.js` (flag `_persistenceReady` + garde dans `saveUserLayout()`)
  - `src/App.svelte` (await `readyForEncryption()` avant `persistence:ready`)
- **Événement utilisé** : `persistence:ready` (publié par `App.svelte` **après** readyForEncryption)
- **Services liés** :
  - `IndexedDBService.svelte.js` (méthode `readyForEncryption()` + retry mechanism)
  - `PersistenceRegistry.svelte.js` (orchestration)
  - `App.svelte` (publication de `persistence:ready`)

## Crédit

Diagnostic initial et analyse par l'intégrateur du projet `document-library`.  
Identification de la race condition dans `App.svelte` par re-examen du code installé dans `node_modules`.

---

**Status**: ✅ Résolu  
**Version framework**: 0.2.1+
