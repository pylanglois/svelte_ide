# Persistance Durable du Stockage : Protection contre l'Éviction Automatique

Ce document explique le problème critique de l'éviction automatique des données par les navigateurs et comment `StoragePersistenceService` le résout.

---

## 🔴 Le Problème : Mode "Best-Effort" par Défaut

### Contexte

**Par défaut, les navigateurs traitent IndexedDB, localStorage et autres APIs de stockage en mode "best-effort"**, ce qui signifie :

- ❌ Les données **PEUVENT être supprimées silencieusement** sous pression mémoire
- ❌ Éviction automatique après quelques jours/semaines d'inactivité
- ❌ Aucune garantie de persistance à long terme
- ❌ **L'utilisateur n'est JAMAIS notifié** de la suppression

### Scénarios d'Éviction

Le navigateur supprime automatiquement les données dans ces cas :

1. **Pression sur l'espace disque** : L'utilisateur approche du quota total
2. **Inactivité prolongée** : Site non visité depuis X jours (varie selon navigateurs)
3. **Heuristiques internes** : Algorithmes propriétaires de chaque navigateur
4. **Nettoyage agressif** : Extensions navigateur, mode incognito, paramètres utilisateur

### Impact sur svelte-ide

Pour une application SPA 100% frontend comme svelte-ide :

- 🗂️ **Fichiers téléchargés** → Peuvent disparaître sans avertissement
- 📝 **Layout utilisateur** → Peut être réinitialisé après quelques jours
- ⚙️ **Préférences** → Perdues silencieusement
- 🔐 **Données chiffrées** → Irrécupérables si évincées

**C'est inacceptable pour une application IDE/éditeur où la persistance est critique.**

---

## ✅ La Solution : Storage Persistence API

### Principe

L'API `navigator.storage.persist()` permet de demander au navigateur de passer en mode **"persistent"** :

- ✅ Les données ne sont **JAMAIS supprimées** sans consentement utilisateur explicite
- ✅ Protection contre l'éviction automatique du navigateur
- ✅ Garantie de persistance à long terme
- ✅ Seules actions utilisateur explicites peuvent supprimer (ex: "Effacer les données du site")

### Support Navigateurs

| Navigateur | Support | Comportement |
|-----------|---------|--------------|
| Chrome 55+ | ✅ | Permission automatique si site dans favoris ou visité fréquemment |
| Firefox 55+ | ✅ | Demande permission explicite à l'utilisateur |
| Safari 15.2+ | ✅ | Toujours persistant (pas de mode best-effort) |
| Edge 79+ | ✅ | Identique à Chrome |

**Taux de support global : 98%+ des navigateurs modernes**

---

## 🛠️ Utilisation de `StoragePersistenceService`

### Intégration Automatique (App.svelte)

Le service est **automatiquement appelé au démarrage** de l'application :

```javascript
// src/App.svelte (déjà implémenté)
import { storagePersistenceService } from '@/core/persistence/StoragePersistenceService.svelte.js'

// Au démarrage, après initialisation d'IndexedDB
const granted = await storagePersistenceService.requestPersistence()

if (granted) {
  // ✅ Notification success : "Vos données sont protégées..."
} else {
  // ⚠️ Notification warning : "Ajoutez ce site à vos favoris..."
}
```

### API Publique

Le service est exporté via `svelte-ide/public-api` pour les outils externes :

```javascript
import { storagePersistenceService } from 'svelte-ide'

// 1. Vérifier le statut actuel
const isPersistent = await storagePersistenceService.isPersistent()
console.log(`Mode actuel : ${isPersistent ? 'PERSISTENT ✅' : 'BEST-EFFORT ⚠️'}`)

// 2. Demander la persistance (si pas déjà accordée)
const granted = await storagePersistenceService.requestPersistence()

// 3. Obtenir les informations de quota
const quota = await storagePersistenceService.getQuotaInfo()
console.log(`Utilisé : ${quota.usageFormatted} / ${quota.quotaFormatted} (${quota.percentUsed.toFixed(1)}%)`)

// 4. Vérifier si proche de la limite
const nearLimit = await storagePersistenceService.isQuotaNearLimit(80) // Seuil 80%
if (nearLimit) {
  console.warn('Quota proche de la limite, envisager un nettoyage')
}
```

### Événements Disponibles

Le service publie des événements via `eventBus` :

```javascript
import { eventBus } from 'svelte-ide'

// Persistance accordée
eventBus.subscribe('storage:persistence-granted', ({ persistent, quota }) => {
  console.log('✅ Persistance durable activée', quota)
})

// Persistance refusée
eventBus.subscribe('storage:persistence-denied', ({ persistent, quota }) => {
  console.warn('⚠️ Mode best-effort (risque d\'éviction)', quota)
  // Suggérer à l'utilisateur d'ajouter aux favoris
})

// Erreur lors de la requête
eventBus.subscribe('storage:persistence-error', ({ error }) => {
  console.error('Erreur lors de la demande de persistance', error)
})
```

---

## 📊 Monitoring du Quota

### Afficher le Statut dans l'Interface

Exemple d'intégration dans un composant StatusBar :

```svelte
<script>
import { storagePersistenceService } from 'svelte-ide'
import { onMount } from 'svelte'

let quotaInfo = $state({
  usageFormatted: 'N/A',
  quotaFormatted: 'N/A',
  percentUsed: 0
})

let isPersistent = $state(false)

onMount(async () => {
  isPersistent = await storagePersistenceService.isPersistent()
  quotaInfo = await storagePersistenceService.getQuotaInfo()
  
  // Rafraîchir toutes les 30 secondes
  const interval = setInterval(async () => {
    quotaInfo = await storagePersistenceService.getQuotaInfo()
  }, 30000)
  
  return () => clearInterval(interval)
})
</script>

<div class="storage-status">
  <span class={isPersistent ? 'status-ok' : 'status-warning'}>
    {isPersistent ? '🔒 Persistant' : '⚠️ Volatile'}
  </span>
  <span>
    {quotaInfo.usageFormatted} / {quotaInfo.quotaFormatted}
  </span>
  <progress value={quotaInfo.percentUsed} max="100"></progress>
</div>
```

### Avertissements Proactifs

Implémenter des alertes lorsque le quota atteint un seuil critique :

```javascript
import { storagePersistenceService, ideStore } from 'svelte-ide'

async function checkQuotaWarning() {
  const info = await storagePersistenceService.getQuotaInfo()
  
  if (info.percentUsed >= 90) {
    ideStore.addNotification({
      type: 'error',
      message: `Espace de stockage critique : ${info.percentUsed.toFixed(1)}% utilisé. Supprimez des fichiers pour éviter les erreurs.`,
      duration: 0 // Notification permanente
    })
  } else if (info.percentUsed >= 80) {
    ideStore.addNotification({
      type: 'warning',
      message: `Espace de stockage limité : ${info.percentUsed.toFixed(1)}% utilisé.`,
      duration: 10000
    })
  }
}

// Vérifier périodiquement (ex: toutes les 5 minutes)
setInterval(checkQuotaWarning, 5 * 60 * 1000)
```

---

## 🔍 Debugging et Tests

### Mode Debug

Activer les logs détaillés :

```javascript
storagePersistenceService.setDebugMode(true)

// Logs générés :
// "StoragePersistenceService: Current persistence status = ✅ PERSISTENT"
// "StoragePersistenceService: Quota info { usage: '250 MB', quota: '10 GB', percentUsed: '2.5%' }"
```

### Tests Manuels dans la Console

```javascript
// Accès global (disponible via window dans App.svelte)
window.storagePersistenceService = storagePersistenceService

// Console navigateur
const service = window.storagePersistenceService
await service.isPersistent() // false
await service.requestPersistence() // true (si accordé)
await service.getQuotaInfo()
// { quota: 10737418240, usage: 262144000, percentUsed: 2.44, ... }
```

### Vérifier le Mode Actuel (DevTools)

```javascript
// Console navigateur
await navigator.storage.persisted()
// false = best-effort (risque d'éviction)
// true = persistent (protégé)
```

### Tester l'Acceptation de Persistance

#### Chrome : Méthode 1 - Ajouter aux Favoris

1. Ajouter `localhost:5173` aux favoris (Ctrl+D / Cmd+D)
2. Recharger l'application
3. ✅ La persistance devrait être accordée automatiquement
4. Vérifier dans la console :
   ```javascript
   await navigator.storage.persisted() // true
   ```

#### Chrome : Méthode 2 - DevTools Overrides

Chrome DevTools permet de forcer la persistance pour les tests :

1. Ouvrir DevTools (F12)
2. Aller dans **Application** > **Storage**
3. Trouver la section **"Storage usage"**
4. Cliquer sur **"Grant storage access"** (si disponible)
5. OU utiliser la console :
   ```javascript
   await navigator.storage.persist() // Demander manuellement
   ```

#### Firefox : Demande Explicite

Firefox affiche toujours une popup de permission :

1. Recharger l'application
2. Une notification apparaît : "Autoriser ce site à stocker des données de façon permanente ?"
3. Cliquer sur **"Autoriser"**
4. ✅ La persistance est accordée

#### Safari : Toujours Persistant

Safari ne supporte pas le mode "best-effort" :
- Les données sont **toujours persistantes** par défaut
- Pas de popup, pas de permission à accorder
- `navigator.storage.persisted()` retourne toujours `true`

### Tester le Refus de Permission

Pour tester le scénario où la persistance est refusée :

**Méthode 1 : Révoquer la permission**
```javascript
// Dans DevTools > Application > Storage
// Cliquer sur "Clear site data" puis recharger sans ajouter aux favoris
```

**Méthode 2 : Mode Navigation Privée**
```javascript
// Ouvrir une fenêtre privée (Ctrl+Shift+N / Cmd+Shift+N)
// La persistance est généralement refusée en mode incognito
```

**Méthode 3 : Simuler un site non-favori**
```javascript
// 1. Retirer localhost des favoris
// 2. Effacer l'historique de navigation (pour réinitialiser les heuristiques)
// 3. Recharger l'application
// ⚠️ La notification warning devrait apparaître
```

### Vérifier l'Impact du Refus

Pour confirmer que le warning est justifié :

1. **Sans persistance** :
   ```javascript
   await navigator.storage.persisted() // false
   ```
2. Créer des données dans l'application (fichiers, layout, etc.)
3. Attendre 24-48h sans visiter le site
4. Revenir sur l'application
5. ❌ Les données peuvent avoir été supprimées (varie selon navigateur et pression mémoire)

### Test Automatisé de Persistance

Ajouter ce snippet dans votre suite de tests E2E (Playwright/Cypress) :

```javascript
// test-storage-persistence.spec.js
test('should request persistent storage on app load', async ({ page }) => {
  await page.goto('http://localhost:5173')
  
  // Vérifier que la demande est faite
  const persistenceStatus = await page.evaluate(async () => {
    return await navigator.storage.persisted()
  })
  
  // En développement sans favoris, devrait être false
  expect(persistenceStatus).toBe(false)
  
  // Vérifier que la notification warning est affichée
  await expect(page.locator('.notification.warning')).toBeVisible()
  await expect(page.locator('.notification.warning')).toContainText('données peuvent être supprimées')
})
```

---

## 🚀 Recommandations pour les Intégrateurs

### 1. Toujours Demander la Persistance

**Obligatoire** pour toute application SPA critique (IDE, éditeurs, CMS, etc.) :

```javascript
// Au bootstrap de l'application
await storagePersistenceService.requestPersistence()
```

### 2. Informer l'Utilisateur

Si la persistance est refusée, guider l'utilisateur :

```javascript
if (!granted) {
  ideStore.addNotification({
    type: 'warning',
    message: `
      Vos données risquent d'être supprimées automatiquement.
      Pour les protéger, ajoutez ce site à vos favoris.
    `,
    duration: 0, // Notification permanente
    actions: [
      { label: 'En savoir plus', callback: () => openHelpModal() }
    ]
  })
}
```

### 3. Surveiller le Quota

Implémenter un monitoring régulier pour éviter les erreurs QuotaExceededError :

```javascript
// Vérifier toutes les 5 minutes
setInterval(async () => {
  const nearLimit = await storagePersistenceService.isQuotaNearLimit(85)
  if (nearLimit) {
    // Déclencher un nettoyage automatique ou notifier l'utilisateur
  }
}, 5 * 60 * 1000)
```

### 4. Intégrer dans le Workflow de Sauvegarde

Vérifier la persistance avant des opérations critiques :

```javascript
async function saveImportantData(data) {
  const isPersistent = await storagePersistenceService.isPersistent()
  
  if (!isPersistent) {
    // Avertir l'utilisateur avant la sauvegarde
    const proceed = await modalService.confirm({
      title: 'Avertissement : Stockage non persistant',
      message: 'Vos données ne sont pas protégées contre la suppression automatique. Continuer ?'
    })
    
    if (!proceed) {
      return
    }
  }
  
  // Sauvegarder normalement
  await indexedDBService.save('important', 'data', data)
}
```

---

## 📚 Références

- [MDN : Storage Persistence API](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria)
- [Chrome : Persistent Storage](https://web.dev/persistent-storage/)
- [Can I Use : Storage Persistence](https://caniuse.com/mdn-api_storagemanager_persist)

---

## ✅ Checklist d'Intégration

- [x] `StoragePersistenceService` créé
- [x] Demande automatique de persistance au démarrage (`App.svelte`)
- [x] Notifications utilisateur selon le statut (granted/denied)
- [x] Export dans `public-api.js`
- [x] Documentation complète
- [ ] Tests unitaires (à ajouter)
- [ ] Composant StatusBar pour afficher quota/statut (optionnel)
- [ ] Intégration dans menu "Fichier > Informations de stockage" (optionnel)

---

## 🎯 Impact

**Avant** (mode best-effort) :
- ❌ Fichiers disparaissent après quelques jours
- ❌ Layout réinitialisé silencieusement
- ❌ Aucun contrôle sur la persistance

**Après** (mode persistent) :
- ✅ Données protégées contre l'éviction automatique
- ✅ Persistance garantie à long terme
- ✅ Notifications claires à l'utilisateur
- ✅ Monitoring du quota intégré

**Résultat** : Application SPA fiable et professionnelle, adaptée à une utilisation en production.
