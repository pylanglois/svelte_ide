# Multi-Tokens : Support de Plusieurs Audiences OAuth

## 🎯 Problème Résolu

Quand un frontend demande plusieurs scopes OAuth (ex: `User.Read` + `api://custom/access_as_user`), Azure AD retourne un seul access token avec une audience unique. L'ancien système ne pouvait stocker qu'un seul token, causant des conflits :

- Token pour Graph API (`aud: 00000003-...`) → Backend rejette (401)
- Token pour API custom (`aud: api://...`) → Impossible d'appeler Graph API

## ✅ Solution Implémentée

Système de **multi-tokens** permettant de stocker et récupérer plusieurs tokens simultanément selon leur audience ou scopes.

---

## 📚 Nouvelle API

### `TokenManager`

#### Stockage

```javascript
// Ancien (legacy, toujours supporté)
tokenManager.setTokens(accessToken, refreshToken, expiresIn, userInfo)

// Nouveau (multi-tokens)
tokenManager.setTokens([
  {
    accessToken: 'eyJ...',
    audience: 'api://436fddc9-...',
    scopes: ['access_as_user'],
    expiresIn: 3600
  },
  {
    accessToken: 'eyJ...',
    audience: 'https://graph.microsoft.com',
    scopes: ['User.Read', 'Mail.Read'],
    expiresIn: 3600
  }
], refreshToken, userInfo)
```

#### Récupération

```javascript
// 1. Token par défaut (premier enregistré, compatibilité legacy)
const token = tokenManager.getAccessToken()

// 2. Par audience exacte
const apiToken = tokenManager.getAccessToken('api://436fddc9-7503-41a0-90af-b9de51bb66e6')
const graphToken = tokenManager.getAccessToken('https://graph.microsoft.com')

// 3. Par audience partielle
const customApiToken = tokenManager.getAccessToken('access_as_user')
// ✅ Trouve 'api://436fddc9-.../access_as_user'

// 4. Par scope unique
const mailToken = tokenManager.getAccessToken('Mail.Read')
// ✅ Trouve le token contenant ce scope

// 5. Par liste de scopes (ET logique)
const multiScopeToken = tokenManager.getAccessToken(['User.Read', 'Mail.Read'])
// ✅ Trouve le token ayant TOUS ces scopes
```

### `authStore`

```javascript
import { getAuthStore } from 'svelte-ide'

const authStore = getAuthStore()

// Mêmes paramètres que TokenManager.getAccessToken()
const token = authStore.getAccessToken('api://436fddc9-...')
```

---

## 🔧 Utilisation dans un Projet Client

### Configuration `.env`

```bash
# Demander plusieurs scopes (Graph + API custom)
VITE_AZURE_SCOPES=api://436fddc9-7503-41a0-90af-b9de51bb66e6/access_as_user openid profile email User.Read
```

### Appels API

```javascript
// main.js ou composant appelant
import { getAuthStore } from 'svelte-ide'

const authStore = getAuthStore()

// Appel à VOTRE backend
async function callCustomAPI() {
  const token = authStore.getAccessToken('api://436fddc9-...')
  // OU
  const token = authStore.getAccessToken('access_as_user')
  
  const response = await fetch('https://your-backend.com/api/secure-hello', {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  })
  
  return response.json()
}

// Appel à Microsoft Graph
async function callGraphAPI() {
  const token = authStore.getAccessToken('https://graph.microsoft.com')
  // OU
  const token = authStore.getAccessToken('User.Read')
  
  const response = await fetch('https://graph.microsoft.com/v1.0/me', {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  })
  
  return response.json()
}
```

---

## 🏗️ Architecture Interne

### Flux OAuth avec Multi-Tokens

```
┌─────────────┐
│   Frontend  │
│   Login     │
└──────┬──────┘
       │ Scopes: api://xxx/access_as_user + User.Read
       ▼
┌─────────────────────────┐
│   Azure AD OAuth        │
│ - Génère 1 access token │
│ - Génère 1 ID token     │
│ - Génère 1 refresh token│
└──────┬──────────────────┘
       │
       ▼
┌─────────────────────────────────────────┐
│   AzureProvider.handleOwnCallback()     │
│ 1. Échange code → tokens                │
│ 2. Décode ID token → userInfo           │
│ 3. Extrait audience de access_token     │
│ 4. Retourne format multi-tokens         │
└──────┬──────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────┐
│   AuthManager.handleCallback()          │
│ - Détecte format multi-tokens           │
│ - Appelle tokenManager.setTokens([...]) │
└──────┬──────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────┐
│   TokenManager                          │
│ tokens: Map {                           │
│   'api://436fddc9-...' => {             │
│     accessToken: 'eyJ...',              │
│     expiry: Date,                       │
│     scopes: ['access_as_user']          │
│   },                                    │
│   'https://graph.microsoft.com' => {...}│
│ }                                       │
└─────────────────────────────────────────┘
```

### Persistance

```json
// localStorage/sessionStorage (chiffré)
{
  "tokens": {
    "api://436fddc9-...": {
      "accessToken": "eyJ...",
      "expiry": "2024-11-07T15:30:00Z",
      "scopes": ["access_as_user"]
    },
    "https://graph.microsoft.com": {
      "accessToken": "eyJ...",
      "expiry": "2024-11-07T15:30:00Z",
      "scopes": ["User.Read"]
    }
  },
  "refreshToken": "...",
  "userInfo": {...}
}
```

---

## 🔄 Compatibilité Ascendante

### Format Legacy (Single Token)

Le système détecte automatiquement l'ancien format et le migre :

```javascript
// Ancien code (fonctionne toujours)
tokenManager.setTokens(accessToken, refreshToken, expiresIn, userInfo)

// Nouvelle structure interne (automatique)
tokenManager.tokens.set(audience, {
  accessToken,
  expiry,
  scopes: []
})
```

### Appels Sans Paramètre

```javascript
// Retourne le premier token (compatibilité)
const token = authStore.getAccessToken()
```

---

## 🎓 Cas d'Usage

### Cas 1 : Backend Uniquement

```bash
VITE_AZURE_SCOPES=api://436fddc9-.../access_as_user openid profile email
```

```javascript
// Un seul token stocké
const token = authStore.getAccessToken() // Token API
```

### Cas 2 : Graph API Uniquement

```bash
VITE_AZURE_SCOPES=openid profile email User.Read
```

```javascript
const token = authStore.getAccessToken() // Token Graph
```

### Cas 3 : Backend + Graph (Multi-Tokens)

```bash
VITE_AZURE_SCOPES=api://436fddc9-.../access_as_user openid profile email User.Read
```

```javascript
const apiToken = authStore.getAccessToken('api://436fddc9-...')
const graphToken = authStore.getAccessToken('User.Read')
```

---

## ⚠️ Limitations Actuelles

### Azure AD : Un Seul Access Token

**Important** : Azure AD retourne **toujours UN SEUL access token**, même si plusieurs scopes sont demandés.

- Si scopes = `api://... + User.Read` → Token avec UNE audience (soit api://, soit graph)
- L'audience dépend de l'ordre des scopes et de la configuration Azure

**Solution** : Pour avoir 2 tokens distincts, il faut faire **2 logins séparés** (non implémenté) ou utiliser un **backend proxy**.

### Refresh Token

Le refresh token actuel rafraîchit tous les tokens ensemble. Pas de rafraîchissement sélectif par audience.

---

## 🔍 Debugging

### Activer les Logs

```bash
VITE_AUTH_DEBUG_LOGS=true
```

### Inspecter les Tokens Stockés

```javascript
// Console DevTools
const authStore = getAuthStore()

// Vérifier quel token est retourné
console.log('Default:', authStore.getAccessToken())
console.log('API:', authStore.getAccessToken('api://436fddc9-...'))
console.log('Graph:', authStore.getAccessToken('User.Read'))
```

### Décoder un JWT

```javascript
// Copier le token depuis DevTools Network
const token = 'eyJ...'
const payload = JSON.parse(atob(token.split('.')[1]))
console.log('Audience:', payload.aud)
console.log('Scopes:', payload.scp)
console.log('Expires:', new Date(payload.exp * 1000))
```

---

## 📋 Checklist Migration

Pour migrer un projet existant vers le multi-tokens :

- [ ] Mettre à jour `svelte-ide` vers la version avec multi-tokens
- [ ] Identifier les appels à `authStore.getAccessToken()`
- [ ] Ajouter le paramètre audience/scope pour les appels API custom
- [ ] Tester avec plusieurs scopes dans `VITE_AZURE_SCOPES`
- [ ] Vérifier que le backend reçoit le bon token (aud correct)
- [ ] Activer `VITE_AUTH_DEBUG_LOGS=true` pour valider

---

## 🚀 Évolutions Futures

### Support de Multiples Access Tokens Réels

Pour obtenir plusieurs access tokens distincts (ex: Graph + API custom simultanément), il faudrait :

1. **Backend Proxy** : Le frontend obtient un token API, le backend échange un token Graph
2. **Dual Login** : Deux flux OAuth séparés (UX dégradée)
3. **On-Behalf-Of Flow** : Le backend utilise le token utilisateur pour obtenir d'autres tokens

### Refresh Sélectif

Rafraîchir un token spécifique sans toucher aux autres.

### Token Cache TTL Personnalisé

Configurer des durées de vie différentes par audience.

---

## 📖 Références

- [Azure AD Multiple Resources](https://learn.microsoft.com/en-us/azure/active-directory/develop/v2-oauth2-auth-code-flow#request-an-access-token)
- [OAuth 2.0 Token Exchange](https://datatracker.ietf.org/doc/html/rfc8693)
- [Microsoft Identity Platform Best Practices](https://learn.microsoft.com/en-us/azure/active-directory/develop/identity-platform-integration-checklist)
