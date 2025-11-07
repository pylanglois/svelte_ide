# Fix : Normalisation du champ `sub` dans userInfo (Azure & Google)

## Contexte

L'erreur suivante apparaissait lors de l'authentification Azure :

```
userInfo.sub is required for key derivation
```

## Cause Racine

### Standard OAuth2/OIDC

Le standard OAuth2/OIDC définit le claim **`sub`** (subject) comme l'identifiant unique et immuable de l'utilisateur. Ce champ est utilisé par :

1. **EncryptionKeyDerivation** : Pour dériver une clé de chiffrement unique par utilisateur
2. **TokenManager** : Pour associer les tokens à un utilisateur
3. **Persistance** : Pour isoler les données par utilisateur

### Divergence des Providers

- **Google** : Retourne `sub` nativement (conforme OAuth2/OIDC)
- **Azure** : Retourne `id` via Graph API (correspond à `oid` dans le JWT) au lieu de `sub`

#### Clarification Azure : `oid` vs `id`

**Confusion courante** : Azure utilise deux noms différents pour le même identifiant utilisateur selon le contexte :

| Source | Champ | Valeur | Exemple |
|--------|-------|--------|---------|
| **JWT Token** (backend) | `oid` | Object ID Azure AD | `a1b2c3d4-e5f6-...` |
| **Graph API /me** (frontend) | `id` | Même Object ID | `a1b2c3d4-e5f6-...` |

**Dans svelte-ide** :
- `AzureProvider` appelle **Graph API `/me`** → reçoit `id`
- Le backend décode le **JWT** → lit `oid`
- **Les deux représentent la même valeur** (l'identifiant unique Azure AD de l'utilisateur)

**Pourquoi cette divergence ?**
- JWT suit la spec OAuth2/OIDC : `oid` (Object ID) + `sub` (Subject)
- Graph API suit sa propre convention : `id` (identifiant primaire de l'objet User)
- Microsoft ne garantit pas que `sub` === `oid` (peut différer selon le tenant)

### Code Problématique

**AzureProvider (avant fix) :**
```javascript
return {
  id: userData.id,  // ❌ Pas de 'sub'
  email: userData.mail || userData.userPrincipalName,
  name: userData.displayName,
  provider: 'azure',
  avatar: avatar
}
```

**EncryptionKeyDerivation (validation stricte) :**
```javascript
if (!userInfo.sub) {
  return { valid: false, error: 'userInfo.sub is required for key derivation' }
}
```

## Solution Appliquée

### Normalisation dans AzureProvider

```javascript
// Azure retourne 'id' mais le standard OAuth2/OIDC utilise 'sub' (subject)
// On normalise pour compatibilité avec EncryptionKeyDerivation et autres services
return {
  sub: userData.id,  // Standard OAuth2/OIDC : 'sub' = subject (user unique identifier)
  id: userData.id,   // Gardé pour compatibilité descendante
  email: userData.mail || userData.userPrincipalName,
  name: userData.displayName,
  provider: 'azure',
  avatar: avatar
}
```

### Normalisation dans GoogleProvider

```javascript
// Google retourne 'sub' (subject) selon le standard OAuth2/OIDC
// On normalise pour garantir que 'sub' est toujours présent
return {
  sub: userData.sub || userData.id,  // Standard OAuth2/OIDC
  id: userData.sub || userData.id,   // Compatibilité descendante
  email: userData.email,
  name: userData.name,
  provider: 'google',
  avatar: userData.picture
}
```

## Bénéfices

### ✅ Conformité Standard

- Tous les providers retournent maintenant un `userInfo` conforme OAuth2/OIDC
- Le champ `sub` est **garanti présent** quel que soit le provider

### ✅ Compatibilité Descendante

- Le champ `id` est conservé pour ne pas casser le code existant
- Migration transparente pour les applications clientes

### ✅ Dérivation de Clé Fonctionnelle

- `EncryptionKeyDerivation` fonctionne maintenant avec Azure
- Chiffrement des tokens au repos possible avec tous les providers

## Impact Backend

### Problème Backend Associé

Le backend peut également rencontrer l'erreur `401 Unauthorized` si :

1. Le token Azure n'a pas le bon `audience` (aud)
2. Le backend valide le JWT avec un `audience` différent

### Configuration Backend Requise

**Pour Azure :**
```bash
# .env backend
AUTH_PROVIDER=azure
AUTH_API_AUDIENCE=api://436fddc9-7503-41a0-90af-b9de51bb66e6
AUTH_AUTHORITY=https://login.microsoftonline.com/<tenant-id>
```

**Scopes Frontend :**
```bash
# .env frontend
VITE_AZURE_API_SCOPE=api://436fddc9-7503-41a0-90af-b9de51bb66e6/access_as_user
```

### Validation JWT Backend

Le backend doit valider le JWT en vérifiant :

```python
# Exemple Python (FastAPI)
from jose import jwt

decoded = jwt.decode(
    token,
    key=public_key,
    algorithms=["RS256"],
    audience="api://436fddc9-7503-41a0-90af-b9de51bb66e6"  # Doit matcher le scope
)

# Azure JWT contient :
# - aud : api://436fddc9-7503-41a0-90af-b9de51bb66e6
# - oid : identifiant unique utilisateur
# - sub : peut être différent de oid (utilisé pour dépréciation)
```

## Test de Non-Régression

### Frontend

```javascript
import { getAuthStore } from 'svelte-ide'

const authStore = getAuthStore()
await authStore.login('azure')  // ou 'google'

const user = authStore.currentUser
console.log('sub:', user.sub)  // ✅ Doit être défini
console.log('id:', user.id)    // ✅ Doit être défini
console.log('email:', user.email)

// Test dérivation de clé
import { deriveEncryptionKey } from 'svelte-ide'
const key = await deriveEncryptionKey(user)
console.log('Encryption key derived:', key.substring(0, 8) + '...')
```

### Backend

```bash
# Générer token Azure via UI, puis tester
curl -X GET http://localhost:8800/api/v1/secure-hello \
  -H "Authorization: Bearer <azure-token>"

# Résultat attendu : 200 OK
{"message": "Hello from secured endpoint!", "user": "user@example.com"}
```

## Références

- **OAuth2/OIDC Standard** : https://openid.net/specs/openid-connect-core-1_0.html#StandardClaims
- **Azure AD Claims** : https://learn.microsoft.com/en-us/entra/identity-platform/access-tokens
- **Google OAuth Claims** : https://developers.google.com/identity/openid-connect/openid-connect#an-id-tokens-payload

## Prochaines Étapes

1. ✅ Fix appliqué dans AzureProvider et GoogleProvider
2. ✅ Export de `getAuthStore` dans public-api.js
3. 📋 Tester avec un backend configuré Azure
4. 📋 Documenter la configuration backend dans ENVIRONMENT_VARIABLES.md
5. 📋 Ajouter MockProvider avec `sub` pour tests unitaires
