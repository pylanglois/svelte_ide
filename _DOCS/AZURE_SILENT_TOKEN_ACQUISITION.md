# Acquisition Silencieuse de Tokens Multiples (Silent Token Acquisition)

## 🎯 Problème

Azure AD retourne **un seul access token** même si plusieurs scopes sont demandés :

```bash
VITE_AZURE_SCOPES=api://436fddc9-.../access_as_user openid profile email User.Read
```

**Résultat** : Token avec `aud: 00000003-0000-0000-c000-000000000000` (Graph API)  
**Problème** : Pas de token pour l'API custom (`api://436fddc9-...`)

## ✅ Solution : `acquireTokenSilent`

Après le login initial, on acquiert **silencieusement** (sans interaction utilisateur) un second token pour l'API custom.

### Flux

```
1. Login Initial
   ↓
   Scopes: User.Read, profile, openid, email
   → Token Graph API (aud: 00000003-...)

2. acquireTokenSilent (automatique)
   ↓
   Scopes: api://436fddc9-.../access_as_user
   → Token API Custom (aud: api://436fddc9-...)

3. Résultat
   → 2 tokens stockés dans TokenManager
```

### Configuration Azure AD Requise

Pour que `acquireTokenSilent` fonctionne, il faut ajouter l'URL de callback silencieuse :

1. **Azure Portal** → App Registration → **Authentication**
2. Ajouter une **Single-page application** redirect URI :
   ```
   http://localhost:5173/auth-silent-callback.html
   ```
3. Pour la production :
   ```
   https://votre-domaine.com/auth-silent-callback.html
   ```

### Fichier `/public/auth-silent-callback.html`

Ce fichier HTML est chargé dans un iframe caché et renvoie le code d'autorisation au parent :

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Silent Auth</title>
</head>
<body>
  <script>
    (function() {
      const urlParams = new URLSearchParams(window.location.search)
      const code = urlParams.get('code')
      const error = urlParams.get('error')
      
      if (window.parent && window.parent !== window) {
        if (error) {
          window.parent.postMessage({
            type: 'azure-silent-token',
            error: error
          }, window.location.origin)
        } else if (code) {
          window.parent.postMessage({
            type: 'azure-silent-token',
            code: code
          }, window.location.origin)
        }
      }
    })()
  </script>
</body>
</html>
```

## 🔧 Implémentation

### Logique dans `AzureProvider`

```javascript
// Après le login initial
const accessTokens = []

// Token 1 : Celui reçu du login
accessTokens.push({
  accessToken: tokenData.access_token,
  audience: '00000003-0000-0000-c000-000000000000',
  scopes: ['User.Read', 'profile', 'openid', 'email'],
  expiresIn: 3600
})

// Token 2 : Acquis silencieusement si custom API scope demandé
const customApiScopes = this.scope.split(' ').filter(s => s.startsWith('api://'))
if (customApiScopes.length > 0) {
  const silentToken = await this.acquireTokenSilent(customApiScopes.join(' '))
  accessTokens.push({
    accessToken: silentToken.access_token,
    audience: 'api://436fddc9-...',
    scopes: ['access_as_user'],
    expiresIn: 3600
  })
}
```

### Méthode `acquireTokenSilent`

```javascript
async acquireTokenSilent(scopes) {
  return new Promise((resolve, reject) => {
    // 1. Créer iframe caché
    const iframe = document.createElement('iframe')
    iframe.style.display = 'none'
    
    // 2. Écouter message du iframe
    window.addEventListener('message', (event) => {
      if (event.data.type === 'azure-silent-token') {
        if (event.data.code) {
          // 3. Échanger code → token
          this.exchangeCodeForTokens(event.data.code, codeVerifier)
            .then(resolve)
        }
      }
    })
    
    // 4. Charger URL avec prompt=none
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      response_type: 'code',
      redirect_uri: 'http://localhost:5173/auth-silent-callback.html',
      scope: scopes,
      prompt: 'none'  // ← CRITIQUE : pas d'interaction
    })
    
    iframe.src = `https://login.microsoftonline.com/.../authorize?${params}`
    document.body.appendChild(iframe)
  })
}
```

## 📊 Résultat Attendu

```javascript
// Console après login
🎫 Multi-Tokens Stockés
Nombre de tokens: 2

(index) | Audience                                  | Scopes
--------|-------------------------------------------|------------------------
0       | 00000003-0000-0000-c000-000000000000      | User.Read, profile, ...
1       | api://436fddc9-7503-41a0-90af-b9de51bb66e6 | access_as_user

💡 Pour récupérer un token spécifique:
  authStore.getAccessToken('00000003-0000-0000-c000-000000000000')
  authStore.getAccessToken('api://436fddc9-7503-41a0-90af-b9de51bb66e6')
```

## ⚠️ Limitations

### `prompt=none` Peut Échouer

Si l'utilisateur n'a jamais consenti au scope custom, `prompt=none` retournera une erreur `interaction_required`.

**Solution** : Fallback vers un login interactif classique :

```javascript
try {
  const silentToken = await this.acquireTokenSilent(customApiScopes)
} catch (error) {
  if (error.message.includes('interaction_required')) {
    authWarn('Consent required, skipping silent acquisition')
    // Option : Redirect vers login avec tous les scopes
  }
}
```

### Timeout

Si le iframe met trop de temps (> 10s), on rejette la promesse pour ne pas bloquer l'app.

### CORS et Same-Origin

Le `postMessage` doit respecter `window.location.origin` pour des raisons de sécurité.

## 🧪 Test

1. Déconnectez-vous
2. Videz localStorage/sessionStorage
3. Connectez-vous à Azure
4. Ouvrez la console → Vous devriez voir **2 tokens**
5. Dans votre app client :
   ```javascript
   const apiToken = authStore.getAccessToken('api://436fddc9-...')
   // ✅ Token valide pour votre backend
   
   const graphToken = authStore.getAccessToken('User.Read')
   // ✅ Token valide pour Graph API
   ```

## 📖 Références

- [Azure AD Silent Authentication](https://learn.microsoft.com/en-us/azure/active-directory/develop/v2-oauth2-auth-code-flow#request-an-access-token-silently)
- [MSAL.js acquireTokenSilent](https://github.com/AzureAD/microsoft-authentication-library-for-js/blob/dev/lib/msal-browser/docs/acquire-token.md#silent-requests)
