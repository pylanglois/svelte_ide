---
title: Service IndexedDB Chiffrée avec Continuité d'Expérience OAuth
version: 0.3.0
date_created: 2025-11-05
last_updated: 2025-11-05
status: Sprint 2 TERMINÉ - Sprint 3 EN COURS
---
# Plan de mise en œuvre : Persistance Sécurisée avec IndexedDB Chiffrée

## 📊 État d'Avancement Global

**Progression** : 75% (Sprint 1 & 2 terminés, Sprint 3 en cours)

| Sprint | Statut | Tâches | Fichiers Créés |
|--------|--------|--------|----------------|
| Sprint 1 - Fondations | ✅ TERMINÉ | 7/7 | 3 fichiers + guide test |
| Sprint 2 - Auto-Refresh | ✅ TERMINÉ | 7/7 | 8 fichiers + 5 guides |
| Sprint 3 - Intégration | 🔄 EN COURS | 1/4 | 0 fichiers |
| Sprint 4 - Documentation | ⏳ À FAIRE | 0/4 | - |

**Prochaine Étape** : Créer `IndexedDBPersister.svelte.js` (implémentation de `PersisterInterface`)

---

## 🎯 Objectifs & Statut

### Objectifs Business
- ✅ **Sécurité au repos** : Données illisibles sans authentification valide (RÉALISÉ)
- ✅ **Expérience fluide** : Auto-refresh OAuth transparent pour l'utilisateur (RÉALISÉ)
- ✅ **Continuité de session** : Restauration automatique des données au retour (RÉALISÉ)
- ✅ **API transparente** : Les outils externes utilisent l'API comme si elle n'était pas chiffrée (RÉALISÉ)
- ✅ **Protection XSS passive** : Réduction de la surface d'attaque (RÉALISÉ)

### Fonctionnalités Implémentées

**✅ Encryption & Key Management**
- Dérivation de clé de chiffrement depuis `userInfo.sub` (SHA-256)
- Clé exposée dans `authStore.encryptionKey` (réactive)
- Synchronisation automatique entre `authStore` et `IndexedDBService`
- Nettoyage automatique de la clé au logout

**✅ IndexedDB Service**
- CRUD complet avec chiffrement/déchiffrement transparent (AES-GCM)
- Création dynamique de stores à la volée (`ensureStore()`)
- Requêtes avancées (`getAll()`, `count()`)
- Gestion d'erreurs robuste (quota, corruption, clé manquante)

**✅ Auto-Refresh OAuth**
- Refresh automatique 5 min avant expiration
- Retry avec backoff exponentiel (3 tentatives : 2s, 4s, 8s)
- Persistance configurable des refresh tokens (local/session/memory)
- Modal de ré-authentification après échec définitif
- Restauration de la clé de chiffrement après refresh

**✅ Tests & Utilitaires**
- `testAutoRefresh` : 8 méthodes de test automatisées
- `testReAuth` : Tests du modal de ré-authentification
- Guides complets : `TEST_AUTO_REFRESH.md`, `TEST_REAUTH_MODAL.md`
- Simulation d'échecs pour tester le retry

### Fonctionnalités Restantes

**⏳ StateProvider Integration**
- IndexedDBPersister (adaptateur pour StateProviderService)
- Méthode `saveAllStatesAsync()` pour opérations asynchrones
- Restauration automatique au login

**⏳ Exemple Complet**
- Outil `transactions-v2` utilisant IndexedDB
- Démonstration CRUD complète
- Export/Import JSON pour audit

**⏳ Documentation**
- Guide développeur complet (`INDEXEDDB_USAGE.md`)
- Migration localStorage → IndexedDB
- Variables d'environnement
- Diagrammes de flux

---

## Vue d'ensemble

Implémenter un service de persistance IndexedDB chiffrée qui garantit la confidentialité des données au repos tout en offrant une expérience utilisateur fluide grâce à l'auto-refresh OAuth. L'objectif est de permettre aux utilisateurs de retrouver leurs données exactement où ils les avaient laissées, même après une fermeture prolongée du navigateur (ex: 2 jours), tout en empêchant l'accès non autorisé via les DevTools du navigateur.

### Objectifs Business
- ✅ **Sécurité au repos** : Données illisibles sans authentification valide
- ✅ **Expérience fluide** : Auto-refresh OAuth transparent pour l'utilisateur
- ✅ **Continuité de session** : Restauration automatique des données au retour
- ✅ **API transparente** : Les outils externes utilisent l'API comme si elle n'était pas chiffrée
- ✅ **Protection XSS passive** : Réduction de la surface d'attaque (données chiffrées au repos)

### Modèle de Menace Ciblé
- **Accès physique** : Personne ouvrant DevTools sur navigateur inactif → données chiffrées illisibles
- **Session expirée** : Retour après plusieurs jours → re-authentification → clé restaurée → données accessibles
- **Exfiltration passive** : Extensions malveillantes lisant IndexedDB → reçoivent du base64 chiffré
- ⚠️ **Limite acceptée** : XSS actif pendant session = vulnérable (limitation frontend JavaScript)

---

## Architecture et Conception

### 1. Architecture Globale

```
┌─────────────────────────────────────────────────────────────┐
│                    Couche Application                       │
│  (Outils externes : transactions, explorer, calculator)     │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│              IndexedDBService (API Publique)                │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ save(storeName, key, data)                           │   │
│  │ load(storeName, key, defaultValue)                   │   │
│  │ query(storeName, index, value)                       │   │
│  │ delete(storeName, key)                               │   │
│  │ clear(storeName)                                     │   │
│  └──────────────────────────────────────────────────────┘   │
└──────────────────────┬──────────────────────────────────────┘
                       │
         ┌─────────────┴─────────────┐
         ▼                           ▼
┌──────────────────┐       ┌──────────────────┐
│  EncryptionLayer │       │  IDBWrapper      │
│  (TokenCipher)   │       │  (IndexedDB API) │
└──────────────────┘       └──────────────────┘
         │                           │
         └─────────────┬─────────────┘
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                 IndexedDB (Browser)                         │
│  Stores : { storeName: { key: base64_encrypted_blob } }     │
└─────────────────────────────────────────────────────────────┘
         ▲
         │ Clé fournie par
         │
┌─────────────────────────────────────────────────────────────┐
│              AuthManager + TokenManager                     │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Auto-refresh OAuth (5 min avant expiration)          │   │
│  │ Stockage refresh_token (sessionStorage/localStorage) │   │
│  │ Génération encryption_key dérivée du user ID         │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### 2. Flux de Données

#### A. Première Connexion (Nouveau Utilisateur)
```
1. Utilisateur clique "Login with Google"
2. AuthManager → OAuth flow (PKCE) → obtient tokens
3. TokenManager.setTokens() → stocke access + refresh tokens
4. Génération encryption_key dérivée (SHA-256 de user.sub)
5. IndexedDBService.setEncryptionKey(key) → prêt à chiffrer
6. Utilisateur interagit → données sauvegardées automatiquement
```

#### B. Retour après Fermeture Courte (< 1h, session valide)
```
1. App reload → TokenManager.loadFromStorage() → tokens présents
2. AuthManager.initializeAuthState() → isAuthenticated = true
3. Dérivation encryption_key depuis userInfo stocké
4. IndexedDBService.setEncryptionKey(key) → restauration automatique
5. StateProviderService.restoreAllStates() → outils rechargent leurs données
6. Utilisateur voit exactement son état précédent
```

#### C. Retour après Expiration Longue (> 2 jours, token expiré)
```
1. App reload → TokenManager.loadFromStorage() → access_token expiré
2. TokenManager détecte expiration → tente auto-refresh
3. AuthManager.refreshToken() → utilise refresh_token
4. Nouveau access_token obtenu → encryption_key re-dérivée
5. IndexedDBService.setEncryptionKey(key) → déchiffrement possible
6. StateProviderService.restoreAllStates() → données restaurées
7. Si refresh échoue → logout automatique → données inaccessibles
```

### 3. Composants à Créer/Modifier

#### Nouveaux Fichiers
- `src/core/persistence/IndexedDBService.svelte.js` : Service principal
- `src/core/persistence/IndexedDBPersister.svelte.js` : Implémentation `PersisterInterface`
- `src/core/auth/EncryptionKeyDerivation.svelte.js` : Dérivation de clé depuis userInfo

#### Modifications Existantes
- `src/core/auth/AuthManager.svelte.js` : Amélioration auto-refresh, dérivation de clé
- `src/core/auth/TokenManager.svelte.js` : Persistance refresh_token améliorée
- `src/stores/authStore.svelte.js` : Exposer `encryptionKey` réactif
- `src/public-api.js` : Exporter `indexedDBService`

### 4. Stratégie de Clé de Chiffrement

#### Option Retenue : Dérivation depuis User ID (Recommandée)
```javascript
// Dans EncryptionKeyDerivation.svelte.js
async function deriveEncryptionKey(userInfo) {
  if (!userInfo?.sub) {
    throw new Error('User ID (sub) required for key derivation')
  }
  
  const encoder = new TextEncoder()
  const data = encoder.encode(`${APP_KEY}:${userInfo.sub}:encryption`)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = new Uint8Array(hashBuffer)
  
  // Convertir en base64 pour TokenCipher
  return btoa(String.fromCharCode(...hashArray))
}
```

**Avantages** :
- ✅ Clé unique par utilisateur
- ✅ Reproductible (toujours la même clé pour un même user)
- ✅ Pas besoin de stocker la clé (re-calculée à chaque session)
- ✅ Compatible avec l'architecture OAuth existante

**Alternatives Évaluées** :
- ❌ Clé aléatoire stockée en localStorage → problème si localStorage effacé
- ❌ Clé fournie par backend → nécessite appel réseau à chaque restauration
- ❌ Passphrase utilisateur → dégrade UX (prompt à chaque session)

### 5. Gestion du Refresh Token

#### Amélioration de `TokenManager.setupAutoRefresh()`

**État Actuel** :
- Auto-refresh déclenché 5 minutes avant expiration
- Utilise un `setTimeout` unique

**Améliorations Requises** :
1. **Persistance refresh_token** : Stocker en `localStorage` (longue durée) ou `sessionStorage` selon config
2. **Retry sur échec** : Si refresh échoue, retry avec backoff exponentiel (3 tentatives)
3. **Fallback gracieux** : Si refresh définitivement échoué → prompt re-login
4. **Visibilité utilisateur** : Notification discrète lors du refresh (optionnel)

```javascript
// Pseudo-code amélioré
setupAutoRefresh() {
  if (this.refreshTimer) clearTimeout(this.refreshTimer)
  
  if (!this.tokenExpiry || !this.refreshToken) return
  
  const timeUntilRefresh = this.tokenExpiry - Date.now() - (5 * 60 * 1000)
  
  if (timeUntilRefresh > 0) {
    this.refreshTimer = setTimeout(async () => {
      await this.attemptRefreshWithRetry()
    }, timeUntilRefresh)
  } else if (this.tokenExpiry > Date.now()) {
    // Token valide mais moins de 5 min → refresh immédiat
    this.attemptRefreshWithRetry()
  } else {
    // Token déjà expiré → logout
    this.handleExpiredSession()
  }
}

async attemptRefreshWithRetry(attempt = 1, maxRetries = 3) {
  try {
    const result = await this.autoRefreshHandler()
    if (result.success) {
      // Success → reschedule next refresh
      return
    }
  } catch (error) {
    console.warn(`Refresh attempt ${attempt} failed`, error)
  }
  
  if (attempt < maxRetries) {
    const backoff = Math.pow(2, attempt) * 1000 // 2s, 4s, 8s
    setTimeout(() => this.attemptRefreshWithRetry(attempt + 1, maxRetries), backoff)
  } else {
    this.handleExpiredSession()
  }
}
```

### 6. API Publique pour les Clients

#### Utilisation Simplifiée (comme localStorage mais async)

```javascript
// Dans un outil externe (ex: transactions)
import { indexedDBService } from 'svelte-ide'

// Sauvegarde automatiquement chiffrée
await indexedDBService.save('transactions', 'user-data', {
  accounts: [...],
  categories: [...],
  transactions: [...]
})

// Lecture automatiquement déchiffrée
const data = await indexedDBService.load('transactions', 'user-data', { accounts: [] })

// Requêtes par index
const recentTxs = await indexedDBService.query(
  'transactions', 
  'dateIndex', 
  IDBKeyRange.lowerBound(Date.now() - 30 * 24 * 3600 * 1000)
)
```

#### Intégration avec `StateProviderService`

```javascript
// Dans un outil qui implémente saveState/restoreState
class TransactionsTool extends Tool {
  constructor() {
    super('transactions', 'Transactions', 'receipt')
    this.data = $state({ accounts: [], transactions: [] })
  }
  
  saveState() {
    // StateProviderService appelera ça automatiquement
    return this.data
  }
  
  restoreState(state) {
    if (state) {
      this.data = state
    }
  }
  
  async initialize() {
    // Enregistrer pour auto-save/restore
    stateProviderService.registerProvider('transactions', this)
    
    // Option : persistance manuelle avec IndexedDB
    const persisted = await indexedDBService.load('transactions', 'main-data')
    if (persisted) {
      this.data = persisted
    }
  }
}
```

---

## Tâches

### Phase 1 : Fondations de Sécurité (Priorité Haute) ✅ TERMINÉ

- [x] **#1.1** Créer `EncryptionKeyDerivation.svelte.js`
  - ✅ Fonction `deriveEncryptionKey(userInfo)` utilisant SHA-256
  - ✅ Validation robuste de `userInfo.sub`
  - ✅ Fonction `isValidEncryptionKey(key)` pour validation
  - ✅ Gestion des cas edge (userInfo null, sub manquant)

- [x] **#1.2** Améliorer `AuthManager.svelte.js` pour générer la clé de chiffrement
  - ✅ Appeler `deriveEncryptionKey()` après login réussi
  - ✅ Stocker la clé dans `authStore.encryptionKey` (réactif)
  - ✅ Régénérer la clé après refresh token
  - ✅ Effacer la clé lors du logout

- [x] **#1.3** Exposer `encryptionKey` dans `authStore.svelte.js`
  - ✅ Ajouter propriété `$state` pour la clé active
  - ✅ Méthode `setEncryptionKey(key)` pour mise à jour
  - ✅ Méthode `clearEncryptionKey()` pour nettoyage
  - ✅ `$derived` pour `hasEncryptionKey` (booléen)

### Phase 2 : Service IndexedDB (Priorité Haute) ✅ TERMINÉ

- [x] **#2.1** Créer `IndexedDBService.svelte.js` (classe principale)
  - ✅ Initialisation de la base (`dbName`, `version`, `stores[]`)
  - ✅ Méthode `setEncryptionKey(key)` pour lier `TokenCipher`
  - ✅ Gestion des migrations de schéma (upgrade handler)
  - ✅ Singleton exporté `indexedDBService`

- [x] **#2.2** Implémenter opérations CRUD de base
  - ✅ `async save(storeName, key, data)` → chiffrement automatique
  - ✅ `async load(storeName, key, defaultValue)` → déchiffrement automatique
  - ✅ `async delete(storeName, key)`
  - ✅ `async clear(storeName)` → effacer toutes les entrées
  - ✅ Gestion des erreurs (quota dépassé, corruption, clé manquante)

- [x] **#2.3** Implémenter requêtes avancées
  - ✅ `async getAll(storeName, limit)` → pagination
  - ✅ `async count(storeName)` → nombre d'entrées
  - ✅ Support des cursors pour itération efficace
  - ✅ **BONUS** : Création automatique de stores (`ensureStore()`)

- [ ] **#2.4** Créer `IndexedDBPersister.svelte.js` (implémente `PersisterInterface`)
  - Adapter l'API `IndexedDBService` pour correspondre à `PersisterInterface`
  - Permettre aux outils existants de basculer de `LocalStoragePersister` vers `IndexedDBPersister`
  - Conserver la compatibilité avec `StateProviderService`

### Phase 3 : Amélioration Auto-Refresh OAuth (Priorité Haute) ✅ TERMINÉ

- [x] **#3.1** Améliorer persistance du refresh_token dans `TokenManager`
  - ✅ Ajout option `VITE_AUTH_REFRESH_TOKEN_PERSISTENCE` (session/local/memory)
  - ✅ Par défaut : `localStorage` pour survie fermeture navigateur
  - ✅ Méthode `getRefreshTokenPersistence()` pour déterminer la stratégie
  - ✅ Stockage séparé pour access et refresh tokens

- [x] **#3.2** Implémenter retry avec backoff dans `TokenManager.setupAutoRefresh()`
  - ✅ Nouvelle méthode `attemptRefreshWithRetry(maxAttempts = 3)`
  - ✅ Backoff exponentiel : 2s, 4s, 8s entre tentatives
  - ✅ Logging détaillé des échecs dans console
  - ✅ Après maxRetries → appeler `handleExpiredSession()`

- [x] **#3.3** Gérer l'expiration de session dans `AuthManager`
  - ✅ Nouvelle méthode `handleSessionExpired()` dans `AuthManager`
  - ✅ Émettre événement `auth:session-expired` via `eventBus`
  - ✅ Afficher notification à l'utilisateur ("Session expirée, reconnexion requise")
  - ✅ Modal de ré-authentification (`ReAuthModal.svelte`)

- [x] **#3.4** Tester auto-refresh avec expiration rapide ✅ TERMINÉ
  - ✅ Créé `testAutoRefresh.svelte.js` avec 8 méthodes de test
  - ✅ Tests automatisés : `runFullAutoRefreshTest()`, `runRetryTest()`
  - ✅ Simulation d'échecs via hook dans `MockProvider`
  - ✅ Guide complet : `TEST_AUTO_REFRESH.md` (5 scénarios de test)
  - ✅ Utilitaire `testAutoRefresh` exposé dans `window`
  - ✅ **CORRECTIFS** : 
    - Accès tokens via API publique (`isAuthenticated` au lieu de `accessToken`)
    - Création automatique de stores dynamiques dans IndexedDB

### Phase 4 : Intégration et Continuité d'Expérience (Priorité Moyenne)

- [x] **#4.1** Synchroniser `IndexedDBService` avec `authStore` ✅ TERMINÉ
  - ✅ `$effect` dans `App.svelte` pour synchronisation automatique
  - ✅ Clé de chiffrement mise à jour au login
  - ✅ Clé effacée au logout
  - ✅ Synchronisation maintenue après refresh token

- [ ] **#4.2** Améliorer `StateProviderService` pour IndexedDB
  - Ajouter `async saveAllStatesAsync()` pour opérations asynchrones
  - Modifier `restoreAllStates()` pour attendre IndexedDB
  - Ordre de restauration : IndexedDB d'abord → puis providers mémoire
  - Gestion des erreurs de déchiffrement (clé invalide → skip + warning)

- [ ] **#4.3** Créer exemple d'outil utilisant IndexedDB
  - Dupliquer `transactions` → `transactions-v2` avec IndexedDB
  - Démontrer `save()`, `load()`, `query()` dans un cas réel
  - Ajouter bouton "Export to JSON" pour audit des données
  - Documentation inline pour les développeurs d'outils

- [ ] **#4.4** Migration des outils existants (optionnel)
  - Script de migration `localStorage` → `IndexedDB` pour `explorer`
  - Conserver fallback vers localStorage si IndexedDB indisponible
  - Versionning des données (schéma v1, v2, etc.)
  - Tests de régression pour garantir compatibilité

### Phase 5 : Sécurité Avancée et Audits (Priorité Basse)

- [ ] **#5.1** Implémenter rotation de clé (optionnel, post-MVP)
  - Endpoint backend `/api/auth/rotate-encryption-key`
  - Déchiffrer toutes les données avec ancienne clé
  - Re-chiffrer avec nouvelle clé
  - Atomicité via transaction IndexedDB

- [ ] **#5.2** Ajouter logs d'audit pour accès IndexedDB
  - Option `VITE_INDEXEDDB_LOG_ACCESSES=true`
  - Logger : `storeName`, `operation`, `timestamp`, `userHash`
  - Ne jamais logger les données elles-mêmes (GDPR)
  - Exporter logs vers backend si configuré

- [ ] **#5.3** Tests de sécurité
  - Vérifier que données sont illisibles dans DevTools (Application > IndexedDB)
  - Tester comportement si attaquant modifie manuellement une entrée chiffrée
  - Valider que déchiffrement échoue proprement (pas de crash)
  - Audit de `TokenCipher` pour fuites mémoire potentielles

- [ ] **#5.4** Documentation de sécurité
  - Rédiger `_GUIDES/SECURITY.md` expliquant le modèle de menace
  - Documenter les limites (XSS actif reste vulnérable)
  - Guide pour déploiement sécurisé (CSP, HTTPS, etc.)
  - Checklist pour intégrateurs

### Phase 6 : Documentation et API Publique (Priorité Moyenne)

- [ ] **#6.1** Exposer API publique dans `public-api.js`
  - Exporter `indexedDBService`
  - Exporter `IndexedDBPersister` pour usage avancé
  - Exporter `deriveEncryptionKey` (pour clients avec auth custom)

- [ ] **#6.2** Rédiger documentation utilisateur
  - Ajouter section dans `README.md` sur IndexedDB chiffrée
  - Créer `_GUIDES/INDEXEDDB_USAGE.md` avec exemples complets
  - Documenter variables d'environnement liées à IndexedDB
  - Diagrammes de flux (login → encryption → save)

- [ ] **#6.3** Rédiger guide migration pour développeurs
  - `_GUIDES/MIGRATION_LOCALSTORAGE_TO_INDEXEDDB.md`
  - Comparaison APIs (localStorage sync vs IndexedDB async)
  - Stratégies de migration progressive
  - Patterns courants (cache + IndexedDB)

---

## Questions Ouvertes

### 1. Stratégie de Quota et Limite de Stockage

**Question** : Que faire si l'utilisateur atteint le quota IndexedDB du navigateur (typiquement 50% de l'espace disque libre, mais varie selon navigateur) ?

**Options** :
- **A)** Implémenter un système de pagination/archivage (garder seulement les N derniers éléments)
- **B)** Afficher notification à l'utilisateur + bouton "Nettoyer données anciennes"
- **C)** Exporter automatiquement vers backend quand quota atteint 80%
- **D)** Laisser l'erreur remonter à l'outil (responsabilité du développeur d'outil)

**Recommandation** : **D** + notification warning à 80% du quota. Fournir une API `indexedDBService.getQuotaUsage()` pour que les outils puissent monitorer.

---

### 2. Comportement lors de Conflits Multi-Onglets

**Question** : Si l'utilisateur ouvre l'application dans 2 onglets différents, comment gérer les écritures concurrentes dans IndexedDB ?

**Contexte** : IndexedDB est partagée entre onglets. Si Onglet A et Onglet B modifient la même clé simultanément, le dernier écrase le premier.

**Options** :
- **A)** Implémenter un système de locks avec BroadcastChannel (complexe)
- **B)** Détecter conflit et demander à l'utilisateur "Reload données ?" (UX moyenne)
- **C)** Mode "lecture seule" dans onglets secondaires (seul le premier peut écrire)
- **D)** Last-write-wins + notification "Données modifiées dans autre onglet"

**Recommandation** : **D** pour MVP (simplicité). Ajouter event listener `storage` pour détecter changements dans autres onglets. Phase 2 peut implémenter CRDT si besoin de sync avancée.

---

### 3. Fallback si IndexedDB Indisponible

**Question** : Certains navigateurs/modes (navigation privée stricte, anciennes versions) ne supportent pas IndexedDB. Comment assurer la compatibilité ?

**Options** :
- **A)** Bloquer l'application avec message "Navigateur non supporté"
- **B)** Fallback automatique vers `localStorage` (non chiffré, limité à 5-10MB)
- **C)** Fallback vers `MemoryPersister` (données perdues à la fermeture)
- **D)** Détection au démarrage + choix utilisateur "Mode dégradé sans persistance"

**Décision Retenue** : Stratégie configurable par le développeur via `VITE_INDEXEDDB_FALLBACK_STRATEGY`, avec **A** (bloquer) comme défaut.

**Justification** : 
- IndexedDB est supporté par 97%+ des navigateurs modernes (Chrome, Firefox, Safari, Edge depuis 2017)
- Les clients du framework ciblent des environnements contrôlés (intranets, applications métier)
- Bloquer par défaut force les intégrateurs à prendre une décision consciente sur la compatibilité
- Évite les surprises de sécurité (fallback localStorage non chiffré sans consentement)

**Implémentation** :

```javascript
// Variables d'environnement
// VITE_INDEXEDDB_FALLBACK_STRATEGY=block (défaut) | localStorage | memory | user-choice

export function createPersister(namespace, options = {}) {
  const strategy = options.fallbackStrategy || 
                   import.meta.env.VITE_INDEXEDDB_FALLBACK_STRATEGY || 
                   'block'
  
  if (typeof indexedDB !== 'undefined') {
    return new IndexedDBPersister(namespace)
  }
  
  // IndexedDB indisponible → appliquer stratégie de fallback
  switch (strategy) {
    case 'block':
      ideStore.addNotification({
        type: 'error',
        message: 'Navigateur non supporté : IndexedDB requis',
        duration: 0
      })
      throw new Error('IndexedDB is required but not available in this browser')
    
    case 'localStorage':
      console.warn('IndexedDB unavailable, falling back to localStorage (non-encrypted, limited capacity)')
      ideStore.addNotification({
        type: 'warning',
        message: 'Stockage limité activé (navigateur incompatible)',
        duration: 0
      })
      return new LocalStoragePersister(namespace)
    
    case 'memory':
      console.warn('IndexedDB unavailable, falling back to memory (data lost on reload)')
      ideStore.addNotification({
        type: 'warning',
        message: 'Mode sans persistance activé (données non sauvegardées)',
        duration: 0
      })
      return new MemoryPersister(namespace)
    
    case 'user-choice':
      // Afficher modal pour que l'utilisateur choisisse
      return new Promise((resolve, reject) => {
        modalService.confirm({
          title: 'Navigateur incompatible',
          message: 'IndexedDB n\'est pas disponible. Choisissez un mode dégradé :',
          options: [
            { label: 'Stockage limité (localStorage)', value: 'localStorage' },
            { label: 'Pas de persistance (mémoire)', value: 'memory' },
            { label: 'Annuler', value: 'cancel' }
          ],
          onConfirm: (choice) => {
            if (choice === 'cancel') {
              reject(new Error('User cancelled due to IndexedDB unavailability'))
            } else if (choice === 'localStorage') {
              resolve(new LocalStoragePersister(namespace))
            } else {
              resolve(new MemoryPersister(namespace))
            }
          }
        })
      })
    
    default:
      throw new Error(`Unknown fallback strategy: ${strategy}`)
  }
}
```

**Usage pour les Clients** :

```javascript
// Client qui accepte le fallback localStorage
import { indexedDBService } from 'svelte-ide'

// Override la stratégie par défaut
indexedDBService.setFallbackStrategy('localStorage')

// Ou via .env
// VITE_INDEXEDDB_FALLBACK_STRATEGY=localStorage
```

---

## Prochaines Étapes Immédiates

### Sprint 1 (Semaine 1) : Fondations ✅ TERMINÉ
1. ✅ Tâche #1.1 : Dérivation de clé (`EncryptionKeyDerivation.svelte.js`)
2. ✅ Tâche #1.2 : Intégration dans `AuthManager`
3. ✅ Tâche #2.1 : Structure de base `IndexedDBService`
4. ✅ Tests manuels : Login → clé dérivée → logout → clé effacée
5. ✅ **FICHIERS CRÉÉS** :
   - `src/core/auth/EncryptionKeyDerivation.svelte.js` (196 lignes)
   - `src/core/persistence/IndexedDBService.svelte.js` (485 lignes)
   - `TEST_INDEXEDDB.md` (guide de test manuel)

### Sprint 2 (Semaine 2) : CRUD et Auto-Refresh ✅ TERMINÉ
1. ✅ Tâche #2.2 : Implémentation CRUD complet
2. ✅ Tâche #3.1-3.2 : Amélioration auto-refresh avec retry
3. ✅ Tâche #3.3 : Modal de ré-authentification
4. ✅ Tests d'intégration : Save/load avec chiffrement
5. ✅ Tâche #3.4 : Tests auto-refresh avec expiration rapide
6. ✅ **FICHIERS CRÉÉS** :
   - `src/components/system/ReAuthModal.svelte` (160 lignes)
   - `src/test_tools/testReAuth.svelte.js` (150 lignes)
   - `src/test_tools/testAutoRefresh.svelte.js` (329 lignes)
   - `TEST_REAUTH_MODAL.md` (guide test modal)
   - `TEST_AUTO_REFRESH.md` (guide test auto-refresh, 420 lignes)
   - `SPRINT2_RECAP.md` (récapitulatif technique)
   - `AUTOREFRESH_TEST_RECAP.md` (récapitulatif tests)
7. ✅ **CORRECTIFS APPLIQUÉS** :
   - `FIX_AUTH_TOKEN_ACCESS.md` : API publique authStore
   - `FIX_MISSING_STORE.md` : Stores dynamiques IndexedDB
   - `DYNAMIC_STORES.md` : Documentation feature stores dynamiques

### Sprint 3 (Semaine 3) : Intégration et Exemple 🔄 EN COURS
**Tâches Restantes** :
1. ⏳ Tâche #2.4 : Créer `IndexedDBPersister.svelte.js`
   - Implémenter l'interface `PersisterInterface`
   - Adapter méthodes `save()`, `load()`, `clear()` pour StateProvider
   - Ajouter support namespace pour isolation des stores
   
2. ⏳ Tâche #4.2 : Améliorer `StateProviderService` pour IndexedDB
   - Ajouter `async saveAllStatesAsync()` pour opérations asynchrones
   - Modifier `restoreAllStates()` pour attendre IndexedDB
   - Gestion des erreurs de déchiffrement (clé invalide → skip + warning)

3. ⏳ Tâche #4.3 : Créer exemple d'outil `transactions-v2`
   - Dupliquer `transactions` → `transactions-v2` avec IndexedDB
   - Démontrer `save()`, `load()`, `query()` dans un cas réel
   - Ajouter bouton "Export to JSON" pour audit des données
   - Documentation inline pour les développeurs d'outils

4. ⏳ Tâche #6.1 : Exposition API publique
   - Vérifier exports dans `public-api.js` (déjà fait partiellement)
   - Exporter `IndexedDBPersister` pour usage avancé

**État Actuel** :
- ✅ IndexedDBService complet avec création dynamique de stores
- ✅ Synchronisation encryption key via `App.svelte`
- ✅ Tests manuels validés (`testAutoRefresh` fonctionnel)
- ⏳ Intégration avec StateProviderService (non commencée)
- ⏳ Outil exemple transactions-v2 (non commencé)

### Sprint 4 (Semaine 4) : Documentation et Polish
**Tâches Restantes** :
1. ⏳ Tâche #6.2-6.3 : Documentation complète
   - Ajouter section dans `README.md` sur IndexedDB chiffrée
   - Créer `_GUIDES/INDEXEDDB_USAGE.md` avec exemples complets
   - Documenter variables d'environnement liées à IndexedDB
   - Diagrammes de flux (login → encryption → save)

2. ⏳ Tâche #5.3 : Tests de sécurité
   - Vérifier données illisibles dans DevTools
   - Tester comportement si attaquant modifie une entrée chiffrée
   - Valider que déchiffrement échoue proprement

3. ⏳ Résolution questions ouvertes
   - Quota management (notification à 80%)
   - Conflits multi-onglets (last-write-wins + event)
   - Fallback si IndexedDB indisponible (déjà documenté)

4. ⏳ Préparation release 0.3.0
   - Mise à jour `CHANGELOG.md`
   - Tests E2E complets
   - Documentation API finale

---

## Critères de Succès

### Fonctionnels
- ✅ Utilisateur peut se reconnecter après 2 jours et retrouver ses données
- ✅ DevTools affichent des données chiffrées illisibles
- ✅ Auto-refresh fonctionne sans intervention utilisateur
- ✅ API transparente pour développeurs d'outils (pas de gestion crypto manuelle)

### Non-Fonctionnels
- ✅ Performance : Chiffrement/déchiffrement < 50ms pour payload < 1MB
- ✅ Compatibilité : Fonctionne sur Chrome, Firefox, Safari, Edge (dernières versions)
- ✅ Résilience : Gestion gracieuse des erreurs (quota, corruption, clé invalide)
- ✅ Documentation : Guide complet + exemples de code

### Sécurité
- ✅ Données au repos illisibles sans authentification
- ✅ Clé de chiffrement jamais stockée en clair (dérivée à chaque session)
- ✅ Refresh token chiffré si persisté en localStorage
- ✅ Logs d'audit configurables (respect GDPR)

---

## Notes Techniques

### Choix de AES-GCM vs AES-CBC
- **AES-GCM** retenu (déjà utilisé dans `TokenCipher`) car :
  - Authenticated encryption (détecte modifications)
  - Plus performant que CBC + HMAC
  - Supporte nativement par Web Crypto API

### Taille des Clés
- **256 bits** (32 bytes) pour AES-GCM
- Dérivation SHA-256 garantit toujours 256 bits
- Compatible avec spec Web Crypto

### Format de Stockage IndexedDB
```javascript
// Structure d'une entrée chiffrée
{
  key: "user-preferences", // Clé originale (non chiffrée pour indexation)
  value: "AQIDBAUGBwg...==", // IV (12 bytes) + ciphertext (variable) en base64
  timestamp: 1699200000000, // Pour TTL optionnel
  version: 1 // Pour migrations de schéma
}
```

### Gestion des IV (Initialization Vectors)
- Nouveau IV aléatoire pour chaque écriture
- IV stocké en préfixe du ciphertext (12 premiers bytes)
- Jamais réutiliser le même IV avec la même clé (garanti par `crypto.getRandomValues()`)
