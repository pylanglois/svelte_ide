# Guide Rapide : Multi-Tokens OAuth

## 🚀 Utilisation dans Votre Projet Client

### 1. Configuration `.env`

```bash
# Demander plusieurs scopes (API custom + Graph)
VITE_AZURE_SCOPES=api://436fddc9-7503-41a0-90af-b9de51bb66e6/access_as_user openid profile email User.Read
```

### 2. Appeler Votre Backend

```javascript
import { getAuthStore } from 'svelte-ide'

const authStore = getAuthStore()

// Récupérer le token pour VOTRE API
const apiToken = authStore.getAccessToken('api://436fddc9-7503-41a0-90af-b9de51bb66e6')
// OU recherche partielle
const apiToken = authStore.getAccessToken('access_as_user')

// Faire l'appel
const response = await fetch('http://localhost:8000/api/v1/secure-hello', {
  headers: {
    'Authorization': `Bearer ${apiToken}`
  }
})
```

### 3. Appeler Microsoft Graph (optionnel)

```javascript
// Récupérer le token Graph
const graphToken = authStore.getAccessToken('https://graph.microsoft.com')
// OU par scope
const graphToken = authStore.getAccessToken('User.Read')

// Appeler Graph API
const response = await fetch('https://graph.microsoft.com/v1.0/me', {
  headers: {
    'Authorization': `Bearer ${graphToken}`
  }
})
```

## 📋 Toutes les Façons de Récupérer un Token

```javascript
// 1. Token par défaut (premier enregistré)
authStore.getAccessToken()

// 2. Par audience complète
authStore.getAccessToken('api://436fddc9-7503-41a0-90af-b9de51bb66e6')
authStore.getAccessToken('https://graph.microsoft.com')

// 3. Par audience partielle
authStore.getAccessToken('access_as_user')
authStore.getAccessToken('436fddc9')

// 4. Par scope
authStore.getAccessToken('User.Read')
authStore.getAccessToken('Mail.Read')

// 5. Par liste de scopes (AND)
authStore.getAccessToken(['User.Read', 'Mail.Read'])
```

## 🔍 Vérifier Quel Token Est Retourné

```javascript
// Activer les logs de debug
// .env : VITE_AUTH_DEBUG_LOGS=true

const token = authStore.getAccessToken('api://...')

// Console navigateur affichera:
// [Auth] Access token read (by audience)
//   audience: api://436fddc9-...
//   accessToken: eyJ...xyz
//   expiresAt: 2024-11-07T16:30:00Z
```

## ⚠️ Attention : Azure Retourne UN SEUL Token

Même avec plusieurs scopes, Azure retourne **un seul access_token** avec **une seule audience**.

**Exemple :**
```bash
VITE_AZURE_SCOPES=api://xxx/access_as_user User.Read
```

Résultat possible :
- ✅ Token avec `aud: api://xxx` → Votre backend fonctionne, Graph échoue
- ✅ Token avec `aud: https://graph.microsoft.com` → Graph fonctionne, backend échoue

**Solution actuelle :** Le système stocke le token unique et détecte son audience.

**Pour avoir 2 tokens distincts :** Il faut un backend proxy ou deux logins séparés (pas implémenté).

## 📖 Documentation Complète

Voir `_DOCS/MULTI_TOKENS_IMPLEMENTATION.md` pour l'architecture détaillée.
