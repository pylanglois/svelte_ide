# Stores Dynamiques dans IndexedDB

## Fonctionnalité

L'IndexedDBService supporte maintenant la **création automatique de stores** lors de la première utilisation. Cela simplifie grandement l'utilisation pour les développeurs d'outils.

## Utilisation

### Avant (nécessitait initialisation manuelle)

```javascript
// Il fallait déclarer tous les stores au démarrage
await indexedDBService.initialize(['default', 'tools', 'layout', 'mon-store-custom'])

// Puis utiliser
await indexedDBService.save('mon-store-custom', 'key', data)
```

### Après (création automatique) ✅

```javascript
// Le store est créé automatiquement au premier save()
await indexedDBService.save('mon-store-custom', 'key', data)

// Ou au premier load()
const data = await indexedDBService.load('mon-store-custom', 'key')
```

## Comment ça fonctionne

### 1. Détection de Store Manquant

Lors d'un `save()` ou `load()`, le service vérifie si le store existe :

```javascript
if (!this.hasStore(storeName)) {
  console.debug(`IndexedDBService: Store "${storeName}" does not exist, creating it...`)
  await this.ensureStore(storeName)
}
```

### 2. Création Dynamique avec Migration de Version

La méthode `ensureStore()` :
1. Ferme la connexion actuelle
2. Incrémente le numéro de version de la base
3. Ouvre la base avec la nouvelle version
4. IndexedDB déclenche `onupgradeneeded`
5. Le store est créé avec les indexes standards

```javascript
async ensureStore(storeName) {
  const currentVersion = this.db.version
  const newVersion = currentVersion + 1

  const request = indexedDB.open(DB_NAME, newVersion)

  request.onupgradeneeded = (event) => {
    const db = event.target.result
    const objectStore = db.createObjectStore(storeName, { keyPath: 'key' })
    objectStore.createIndex('timestamp', 'timestamp', { unique: false })
    objectStore.createIndex('version', 'version', { unique: false })
  }
}
```

### 3. Retour Transparent

Une fois le store créé, l'opération `save()` ou `load()` se poursuit normalement.

## Exemples d'Usage

### Test Tools

```javascript
// testAutoRefresh.svelte.js
await indexedDBService.save('test-auto-refresh', 'test-key', {
  timestamp: Date.now(),
  message: 'Test data'
})

// Le store "test-auto-refresh" est créé automatiquement
```

### Outil Personnalisé

```javascript
// Dans un outil externe
export class MonOutilTool extends Tool {
  async initialize() {
    // Pas besoin de déclarer le store au préalable
    const data = await indexedDBService.load('mon-outil-data', 'config', {
      theme: 'dark',
      language: 'fr'
    })
    
    this.config = data
  }
  
  async saveConfig() {
    // Le store est créé lors du premier save
    await indexedDBService.save('mon-outil-data', 'config', this.config)
  }
}
```

### Tests Unitaires

```javascript
// Chaque test peut utiliser son propre store sans configuration
beforeEach(async () => {
  await indexedDBService.save('test-suite-1', 'key1', mockData)
})

afterEach(async () => {
  await indexedDBService.clear('test-suite-1')
})
```

## Avantages

### 1. Simplicité

✅ **Avant** : Déclarer tous les stores possibles au démarrage  
✅ **Après** : Utiliser directement, création à la demande

### 2. Flexibilité

Les outils externes peuvent créer leurs propres stores sans modifier la configuration centrale :

```javascript
// Plugin tiers peut créer son store sans toucher à App.svelte
await indexedDBService.save('my-plugin-namespace', 'data', pluginData)
```

### 3. Isolation

Chaque outil peut avoir son propre namespace :

```javascript
// Outil A
await indexedDBService.save('tool-a-data', 'key', dataA)

// Outil B
await indexedDBService.save('tool-b-data', 'key', dataB)

// Pas de collision de clés
```

## Performance

### Impact de la Création Dynamique

- **Première utilisation d'un nouveau store** : +50-100ms (migration de version)
- **Utilisations suivantes** : Aucun impact (store existe déjà)

### Optimisation

Pour les outils critiques en performance, vous pouvez pré-créer les stores au démarrage :

```javascript
// Dans App.svelte
await indexedDBService.initialize([
  'default',
  'tools',
  'layout',
  'preferences',
  'high-frequency-tool' // Pré-créé pour éviter latence
])
```

Mais pour la plupart des cas, la création à la demande est suffisante.

## Logs de Débogage

### Store Créé Dynamiquement

```
IndexedDBService: Store "test-auto-refresh" does not exist, creating it...
IndexedDBService: Creating store "test-auto-refresh" (version 2)
IndexedDBService: Object store "test-auto-refresh" created in upgrade
IndexedDBService: Store "test-auto-refresh" created successfully
IndexedDBService: Saved "test-key" in "test-auto-refresh"
```

### Store Déjà Existant

```
IndexedDBService: Saved "test-key" in "test-auto-refresh"
```

## Versionning de la Base

Chaque création de store incrémente la version de la base :

```
Version 1 : Stores initiaux (default, tools, layout, preferences)
Version 2 : + test-auto-refresh
Version 3 : + mon-outil-custom
...
```

IndexedDB gère automatiquement les migrations entre versions.

## Limitations

### 1. Suppression de Stores

La suppression de stores n'est **pas supportée** automatiquement. Pour supprimer un store, vous devez :

```javascript
// Option 1 : Vider le store (conserve la structure)
await indexedDBService.clear('mon-store')

// Option 2 : Migration manuelle (avancé)
// Nécessite une nouvelle version de la base avec deleteObjectStore()
```

### 2. Renommage de Stores

Non supporté directement. Utilisez un pattern de migration :

```javascript
// 1. Copier les données de l'ancien vers le nouveau
const oldData = await indexedDBService.getAll('old-store')
for (const item of oldData) {
  await indexedDBService.save('new-store', item.key, item)
}

// 2. Vider l'ancien store
await indexedDBService.clear('old-store')
```

### 3. Modification des Indexes

Les indexes (`timestamp`, `version`) sont standards pour tous les stores. Pour des indexes personnalisés, utilisez l'initialisation manuelle :

```javascript
// Création manuelle avec indexes custom
const request = indexedDB.open(DB_NAME, newVersion)
request.onupgradeneeded = (event) => {
  const db = event.target.result
  const store = db.createObjectStore('custom-store', { keyPath: 'id' })
  store.createIndex('email', 'email', { unique: true })
  store.createIndex('status', 'status', { unique: false })
}
```

## API Publique Étendue

### Méthode `ensureStore()`

Bien que la création soit automatique, vous pouvez forcer la création d'un store :

```javascript
// Créer un store avant de l'utiliser (pré-allocation)
await indexedDBService.ensureStore('mon-futur-store')

// Puis utiliser normalement
await indexedDBService.save('mon-futur-store', 'key', data)
```

### Méthode `hasStore()`

Vérifier l'existence d'un store :

```javascript
if (indexedDBService.hasStore('mon-store')) {
  console.log('Store existe déjà')
} else {
  console.log('Store sera créé au prochain save/load')
}
```

## Bonnes Pratiques

### 1. Nommage des Stores

Utilisez des noms descriptifs et namespacés :

```javascript
// ✅ Bon
'transactions-data'
'explorer-metadata'
'user-preferences'

// ❌ Éviter
'data'
'temp'
'store1'
```

### 2. Nettoyage des Stores de Test

Les stores de test doivent être nettoyés après usage :

```javascript
async function cleanup() {
  await indexedDBService.clear('test-auto-refresh')
  await indexedDBService.delete('test-auto-refresh', 'test-key')
}
```

### 3. Documentation des Stores Utilisés

Documentez les stores que votre outil utilise :

```javascript
/**
 * Mon Outil
 * 
 * Stores IndexedDB utilisés :
 * - "mon-outil-config" : Configuration utilisateur
 * - "mon-outil-cache" : Cache temporaire des données
 * - "mon-outil-history" : Historique des actions
 */
export class MonOutilTool extends Tool {
  // ...
}
```

---

**Date** : 2025-11-05  
**Feature** : Stores Dynamiques IndexedDB  
**Impact** : `IndexedDBService.svelte.js`, `testAutoRefresh.svelte.js`  
**Bénéfice** : Simplification de l'API, meilleure expérience développeur
