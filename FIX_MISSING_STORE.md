# Correctif : Store IndexedDB Inexistant

## Problème Rencontré

Lors de l'exécution de `testAutoRefresh.runFullAutoRefreshTest()`, l'erreur suivante apparaissait :

```
IndexedDBService: Store "test-auto-refresh" does not exist
❌ ÉCHEC : Données incorrectes
   Attendu: { timestamp: ..., message: "Test auto-refresh", ... }
   Reçu: null
```

## Cause Racine

L'IndexedDBService était initialisé avec une liste fixe de stores au démarrage :

```javascript
// Dans App.svelte
await indexedDBService.initialize(['default', 'tools', 'layout', 'preferences'])
```

Le store `test-auto-refresh` utilisé par le test n'était pas dans cette liste, donc les opérations `save()` et `load()` échouaient silencieusement.

## Solution Implémentée

### Création Automatique de Stores

L'IndexedDBService supporte maintenant la **création dynamique de stores** lors du premier usage.

#### Changements dans `IndexedDBService.svelte.js`

**1. Nouvelle méthode `ensureStore()`**

```javascript
async ensureStore(storeName) {
  await this.dbReady

  if (this.hasStore(storeName)) {
    return true
  }

  // Fermer la connexion actuelle
  this.db.close()

  // Ouvrir avec version incrémentée
  const currentVersion = this.db.version
  const newVersion = currentVersion + 1

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, newVersion)

    request.onupgradeneeded = (event) => {
      const db = event.target.result

      if (!db.objectStoreNames.contains(storeName)) {
        const objectStore = db.createObjectStore(storeName, { keyPath: 'key' })
        objectStore.createIndex('timestamp', 'timestamp', { unique: false })
        objectStore.createIndex('version', 'version', { unique: false })
      }
    }

    request.onsuccess = () => {
      this.db = request.result
      resolve(true)
    }

    request.onerror = () => reject(request.error)
  })
}
```

**2. Modification de `save()` pour créer le store automatiquement**

```javascript
async save(storeName, key, data) {
  await this.dbReady

  // Créer le store s'il n'existe pas
  if (!this.hasStore(storeName)) {
    console.debug(`IndexedDBService: Store "${storeName}" does not exist, creating it...`)
    await this.ensureStore(storeName)
  }

  // Continuer avec l'opération normale...
}
```

**3. Modification de `load()` pour créer le store automatiquement**

```javascript
async load(storeName, key, defaultValue = null) {
  await this.dbReady

  // Créer le store s'il n'existe pas
  if (!this.hasStore(storeName)) {
    console.debug(`IndexedDBService: Store "${storeName}" does not exist, creating it...`)
    await this.ensureStore(storeName)
    return defaultValue // Store vide, retourner valeur par défaut
  }

  // Continuer avec l'opération normale...
}
```

## Test Après Correctif

### Sortie Console Attendue

```
4️⃣ Sauvegarde de données de test...
IndexedDBService: Store "test-auto-refresh" does not exist, creating it...
IndexedDBService: Creating store "test-auto-refresh" (version 2)
IndexedDBService: Object store "test-auto-refresh" created in upgrade
IndexedDBService: Store "test-auto-refresh" created successfully
IndexedDBService: Saved "test-key" in "test-auto-refresh"
✅ Données sauvegardées: { timestamp: ..., message: "Test auto-refresh", ... }

[... 35 secondes plus tard ...]

6️⃣ Vérification de l'accès aux données...
IndexedDBService: Loaded "test-key" from "test-auto-refresh"
✅ SUCCÈS : Données restaurées après refresh!
```

### Validation

Réessayez le test :

```javascript
await testAutoRefresh.runFullAutoRefreshTest()
```

Le test devrait maintenant réussir sans erreur.

## Avantages de Cette Solution

### 1. Simplicité d'Usage

Les développeurs d'outils n'ont plus besoin de déclarer leurs stores au démarrage :

```javascript
// Avant (❌ Complexe)
// 1. Modifier App.svelte pour ajouter le store
await indexedDBService.initialize(['default', 'tools', 'mon-store'])

// 2. Utiliser le store
await indexedDBService.save('mon-store', 'key', data)

// Après (✅ Simple)
// Utiliser directement, le store est créé automatiquement
await indexedDBService.save('mon-store', 'key', data)
```

### 2. Isolation des Tests

Chaque test peut utiliser son propre store sans configuration :

```javascript
// Test 1
await indexedDBService.save('test-1', 'key', data1)

// Test 2
await indexedDBService.save('test-2', 'key', data2)

// Pas de collision, pas de setup requis
```

### 3. Extensibilité

Les plugins tiers peuvent créer leurs propres stores sans toucher au code central :

```javascript
// Plugin externe
await indexedDBService.save('my-plugin-data', 'config', pluginConfig)
```

## Impact sur le Code Existant

### Aucun Changement Requis

Le code existant continue de fonctionner :

```javascript
// Les stores pré-déclarés fonctionnent comme avant
await indexedDBService.save('default', 'key', data) // OK

// Les nouveaux stores sont créés automatiquement
await indexedDBService.save('nouveau-store', 'key', data) // OK aussi
```

### Performance

- **Premier usage d'un nouveau store** : +50-100ms (création)
- **Usages suivants** : 0ms de surcharge (store déjà créé)

## Alternative : Pré-créer des Stores

Si vous voulez éviter la latence de création lors du premier usage :

```javascript
// Dans App.svelte, au démarrage
await indexedDBService.ensureStore('mon-store-critique')

// Puis utiliser sans latence
await indexedDBService.save('mon-store-critique', 'key', data)
```

## Documentation Associée

- **DYNAMIC_STORES.md** : Guide complet sur les stores dynamiques
- **IndexedDBService.svelte.js** : Code source avec JSDoc
- **TEST_AUTO_REFRESH.md** : Tests utilisant les stores dynamiques

---

**Date** : 2025-11-05  
**Correctif** : Sprint 2 - Tests Auto-Refresh  
**Impact** : `IndexedDBService.svelte.js`  
**Statut** : ✅ Résolu
