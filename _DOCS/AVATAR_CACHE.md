# Cache d'Avatars Utilisateurs

## Problème Résolu

Après un refresh token ou un reload de la page, la photo de profil de l'utilisateur disparaissait. Cela nécessitait de re-télécharger l'image depuis l'API du provider OAuth (Azure Graph ou Google), créant :

- ❌ Latence visible (image apparaît après 200-500ms)
- ❌ Requêtes réseau inutiles à chaque session
- ❌ Expérience utilisateur dégradée (avatar "clignote")

## Solution : AvatarCacheService

Un service de cache dédié utilisant IndexedDB pour stocker les photos de profil localement.

### Caractéristiques

- ✅ **Persistance locale** : Stockage du Blob original (MIME type préservé)
- ✅ **TTL de 24h** : Rafraîchissement automatique quotidien (avatars changent rarement)
- ✅ **Isolation par utilisateur** : Cache par `userId` (sub) pour multi-comptes
- ✅ **Nettoyage automatique** : Suppression au logout + expiration automatique
- ✅ **Fallback gracieux** : Si IndexedDB indisponible, téléchargement normal

### Architecture

```
┌─────────────────────────────────────────────────────────┐
│              Flux de Connexion                          │
└─────────────────────────────────────────────────────────┘

1. Login OAuth (Azure/Google)
   ↓
2. getUserInfo() → Vérifie cache avatar
   ├─ Cache HIT → Retourne blob:// instantanément
   └─ Cache MISS → Télécharge depuis API
      ↓
      └─ Sauvegarde dans IndexedDB (userId → Blob)
         ↓
         └─ Retourne blob://

3. Reload/Refresh Token
   ↓
   └─ Cache HIT → Restauration instantanée (pas de requête réseau)

4. Logout
   ↓
   └─ Suppression avatar du cache
```

### Implémentation

#### AzureProvider

```javascript
async getUserInfo(accessToken) {
  const userData = await fetch('https://graph.microsoft.com/v1.0/me')
  const userId = userData.id
  
  // Essayer cache d'abord
  let avatar = await avatarCacheService.getAvatar(userId)
  
  if (!avatar) {
    // Télécharger depuis Graph API
    const photoBlob = await fetch('.../me/photo/$value')
    avatar = await avatarCacheService.saveAvatar(userId, photoBlob)
  }
  
  return { sub: userId, avatar, ... }
}
```

#### GoogleProvider

```javascript
async getUserInfo(accessToken) {
  const userData = await fetch('openidconnect.googleapis.com/v1/userinfo')
  const userId = userData.sub
  
  // Google retourne une URL, on la télécharge pour la mettre en cache
  let avatar = await avatarCacheService.getAvatar(userId)
  
  if (!avatar && userData.picture) {
    const pictureBlob = await fetch(userData.picture)
    avatar = await avatarCacheService.saveAvatar(userId, pictureBlob)
  }
  
  return { sub: userId, avatar, ... }
}
```

### API du Service

```javascript
import { avatarCacheService } from 'svelte-ide'

// Sauvegarder un avatar
const blobUrl = await avatarCacheService.saveAvatar(userId, blob)
// Retourne : "blob:http://localhost:5173/a1b2c3d4-..."

// Récupérer depuis le cache
const blobUrl = await avatarCacheService.getAvatar(userId)
// Retourne : "blob:..." ou null si absent/expiré

// Supprimer un avatar
await avatarCacheService.deleteAvatar(userId)

// Nettoyer avatars expirés (> 24h)
const deletedCount = await avatarCacheService.cleanExpired()

// Vider tout le cache
await avatarCacheService.clearAll()
```

### Structure IndexedDB

**Base de données** : `svelte-ide-auth`  
**Store** : `user-avatars`  
**Clé primaire** : `userId` (sub)

**Schéma d'une entrée** :

```javascript
{
  userId: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  blob: Blob(15243 bytes, type: "image/jpeg"),
  mimeType: "image/jpeg",
  size: 15243,
  timestamp: 1699200000000
}
```

**Index** : `timestamp` (pour nettoyage efficace des expirés)

### Gestion du Cycle de Vie

#### 1. Première Connexion

```
User login → API call → Download avatar → Cache + Display
```

**Console** :
```
[Auth] Azure user avatar downloaded and cached
[Auth] Avatar cached successfully { userId: "a1b2c3d4...", size: 15243, mimeType: "image/jpeg" }
```

#### 2. Reload Page / Refresh Token

```
User returns → Check cache → HIT → Display (no network)
```

**Console** :
```
[Auth] Avatar restored from cache { userId: "a1b2c3d4...", size: 15243, ageMinutes: 42 }
[Auth] Azure user avatar restored from cache
```

#### 3. Expiration (24h)

```
User returns after 25h → Check cache → EXPIRED → Download → Cache + Display
```

**Console** :
```
[Auth] Avatar cache expired { userId: "a1b2c3d4...", ageHours: 25 }
[Auth] Azure user avatar downloaded and cached
```

#### 4. Logout

```
User logout → Delete avatar from cache
```

**Console** :
```
[Auth] Avatar removed from cache { userId: "a1b2c3d4..." }
[Auth] Avatar cache cleared for user
```

### Performance

#### Avant (sans cache)

```
Login → getUserInfo():
  - Graph API /me : 120ms
  - Graph API /photo : 350ms
  TOTAL: 470ms

Reload → getUserInfo():
  - Graph API /me : 120ms
  - Graph API /photo : 350ms
  TOTAL: 470ms (répété à chaque reload!)
```

#### Après (avec cache)

```
Login → getUserInfo():
  - Graph API /me : 120ms
  - Graph API /photo : 350ms
  - Cache save : 5ms
  TOTAL: 475ms (négligeable)

Reload → getUserInfo():
  - Graph API /me : 120ms
  - Cache hit : 2ms
  TOTAL: 122ms (74% plus rapide!)
```

**Économie de bande passante** : ~15-50 KB par reload évité

### Debugging

#### Vérifier le Cache dans DevTools

**Application → IndexedDB → svelte-ide-auth → user-avatars**

Vous devriez voir :

| userId (key) | blob | mimeType | size | timestamp |
|--------------|------|----------|------|-----------|
| a1b2c3d4-... | Blob | image/jpeg | 15243 | 1699200000 |

#### Logs de Debug

Activez les logs détaillés :

```bash
# .env
VITE_AUTH_DEBUG_LOGS=true
```

**Console** :
```
[Auth Debug] Avatar cached successfully { userId: "a1b2c3d4...", size: 15243 }
[Auth Debug] Avatar restored from cache { ageMinutes: 10 }
[Auth Debug] Avatar cache expired { ageHours: 25 }
```

#### Forcer Rafraîchissement

```javascript
// Dans la console du navigateur
const { avatarCacheService } = await import('/src/core/auth/AvatarCacheService.svelte.js')

// Supprimer avatar actuel
await avatarCacheService.deleteAvatar('user-id-here')

// Ou vider tout le cache
await avatarCacheService.clearAll()

// Puis reload → avatar sera re-téléchargé
```

### Limitations

#### 1. Blob URLs et Garbage Collection

Les `blob://` URLs générées par `URL.createObjectURL()` sont automatiquement révoquées :
- ✅ Au reload de la page (pas de fuite mémoire)
- ✅ Au logout (cache supprimé)
- ⚠️ Si vous gardez une référence au Blob, pensez à `URL.revokeObjectURL()` manuellement

#### 2. Quota IndexedDB

- Navigateurs modernes : ~50% de l'espace disque libre
- Photo de profil typique : 10-50 KB
- **Impact négligeable** (même avec 1000 utilisateurs = ~50 MB max)

#### 3. Synchronisation Multi-Onglets

Le cache est **partagé** entre onglets (IndexedDB natif). Si un onglet met à jour l'avatar, les autres onglets verront le cache à jour **après reload**.

Pas de synchronisation temps-réel entre onglets (fonctionnalité supprimée dans Sprint 3 - simplicité KISS).

### Sécurité

#### Pas de Données Sensibles

Les avatars sont des **images publiques** :
- ✅ Pas besoin de chiffrement (déjà publiques sur Google/Azure)
- ✅ Pas de token stocké avec l'image
- ✅ Séparation des bases : `svelte-ide-auth` (avatars) ≠ `svelte-ide-db` (données chiffrées)

#### Isolation par Utilisateur

- Clé de cache = `userId` (sub)
- Impossible pour User A d'accéder à l'avatar de User B
- Nettoyage automatique au logout

### Migration / Compatibilité

#### Projets Existants

**Aucune action requise** :

- ✅ Fonctionne automatiquement après mise à jour
- ✅ Pas de breaking change (API providers inchangée)
- ✅ Fallback gracieux si IndexedDB indisponible

#### Désactiver le Cache (si nécessaire)

```javascript
// Dans votre projet client
import { avatarCacheService } from 'svelte-ide'

// Vider le cache au démarrage
await avatarCacheService.clearAll()

// Ou supprimer la base complète via DevTools
// Application → IndexedDB → svelte-ide-auth → Delete database
```

### Tests

#### Test Manuel

1. **Login** avec Azure/Google
2. **Vérifier** DevTools → IndexedDB → `user-avatars` (entrée présente)
3. **Reload** page → Avatar apparaît instantanément (pas de latence)
4. **Attendre 25h** (ou modifier timestamp dans IndexedDB)
5. **Reload** → Nouvelle requête réseau (cache expiré)
6. **Logout** → Cache supprimé

#### Test Automatisé

```javascript
// test/avatarCache.test.js
import { avatarCacheService } from 'svelte-ide'

test('should cache and retrieve avatar', async () => {
  const userId = 'test-user-123'
  const blob = new Blob(['fake image'], { type: 'image/jpeg' })
  
  // Save
  const url1 = await avatarCacheService.saveAvatar(userId, blob)
  expect(url1).toMatch(/^blob:/)
  
  // Retrieve
  const url2 = await avatarCacheService.getAvatar(userId)
  expect(url2).toMatch(/^blob:/)
  
  // Delete
  await avatarCacheService.deleteAvatar(userId)
  const url3 = await avatarCacheService.getAvatar(userId)
  expect(url3).toBeNull()
})
```

### Prochaines Améliorations (Futures)

- [ ] **Compression** : Réduire taille des avatars (resize à 128x128px)
- [ ] **Prefetch** : Télécharger avatars en arrière-plan pendant le login
- [ ] **Service Worker** : Cache HTTP natif pour les URLs Google (pas de download multiple)
- [ ] **Sync Multi-Onglets** : Événements BroadcastChannel pour mise à jour temps-réel (opt-in)

### Références

- IndexedDB API : https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API
- Blob URLs : https://developer.mozilla.org/en-US/docs/Web/API/URL/createObjectURL
- Azure Graph Photo : https://learn.microsoft.com/en-us/graph/api/profilephoto-get
- Google UserInfo : https://developers.google.com/identity/openid-connect/openid-connect#an-id-tokens-payload
