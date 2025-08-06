# Système d'Authentification OAuth

## Vue d'ensemble

L'IDE intègre un système d'authentification OAuth 2.0 extensible qui permet aux utilisateurs de se connecter via différents fournisseurs (Azure AD, Google, etc.) et aux développeurs d'outils d'accéder aux tokens d'authentification pour leurs appels API.

## Architecture

```
src/core/auth/
├── AuthManager.svelte.js          # Gestionnaire principal
├── AuthProvider.svelte.js         # Classe de base pour providers
├── TokenManager.svelte.js         # Gestion tokens/refresh
└── providers/
    ├── AzureProvider.svelte.js    # Provider Azure AD
    ├── GoogleProvider.svelte.js   # Provider Google
    └── index.js                   # Exports

src/stores/authStore.svelte.js     # Store réactif principal
```

## Configuration

### Variables d'environnement

Créez un fichier `.env` basé sur `.env.example` :

```bash
# Providers activés
VITE_AUTH_PROVIDERS=azure,google

# Azure AD
VITE_AZURE_CLIENT_ID=xxx
VITE_AZURE_TENANT_ID=xxx
VITE_AZURE_REDIRECT_URI=http://localhost:5173/auth/callback

# Google OAuth
VITE_GOOGLE_CLIENT_ID=xxx
VITE_GOOGLE_CLIENT_SECRET=xxx
VITE_GOOGLE_REDIRECT_URI=http://localhost:5173/auth/callback
```

### Configuration des fournisseurs OAuth

#### Azure AD
1. Créez une application dans Azure AD
2. Configurez l'URL de redirection : `http://localhost:5173/auth/callback`
3. Activez les permissions `openid`, `profile`, `email`, `User.Read`

#### Google OAuth
1. Créez un projet dans Google Cloud Console
2. Configurez OAuth 2.0 avec l'URL de redirection
3. Activez les APIs nécessaires

## Utilisation dans les Outils

### API Simple

```javascript
import { ideStore } from '@/stores/ideStore.svelte.js'

// Vérifier l'authentification
if (ideStore.isAuthenticated) {
    const token = ideStore.getAccessToken()
    
    // Faire un appel API
    const response = await fetch('/api/data', {
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        }
    })
}
```

### API Avancée avec authStore

```javascript
import { authStore } from '@/stores/authStore.svelte.js'

// État réactif
$effect(() => {
    if (authStore.isAuthenticated) {
        console.log('Utilisateur connecté:', authStore.currentUser)
        loadUserData()
    }
})

async function makeAuthenticatedRequest(url, options = {}) {
    const token = authStore.getAccessToken()
    
    if (!token) {
        throw new Error('Pas de token d\'authentification')
    }
    
    return fetch(url, {
        ...options,
        headers: {
            ...options.headers,
            'Authorization': `Bearer ${token}`
        }
    })
}

// Gestion du refresh automatique
async function makeRequestWithRetry(url, options = {}) {
    try {
        return await makeAuthenticatedRequest(url, options)
    } catch (error) {
        if (error.status === 401) {
            // Token expiré, tentative de refresh
            try {
                await authStore.refreshToken()
                return await makeAuthenticatedRequest(url, options)
            } catch (refreshError) {
                // Redirect vers login
                await authStore.logout()
                throw refreshError
            }
        }
        throw error
    }
}
```

### Écoute des événements d'authentification

```javascript
import { eventBus } from '@/core/EventBusService.svelte.js'

$effect(() => {
    const unsubscribe1 = eventBus.subscribe('auth:login-success', (data) => {
        console.log('Utilisateur connecté:', data.user)
        initializeToolWithUser(data.user)
    })

    const unsubscribe2 = eventBus.subscribe('auth:logout', () => {
        console.log('Utilisateur déconnecté')
        cleanupUserData()
    })

    const unsubscribe3 = eventBus.subscribe('auth:session-expired', () => {
        console.log('Session expirée')
        showSessionExpiredMessage()
    })

    return () => {
        unsubscribe1()
        unsubscribe2()
        unsubscribe3()
    }
})
```

## Créer un Provider Custom

Pour ajouter support pour un nouveau fournisseur OAuth (ex: Apple, Amazon), créez une classe qui étend `AuthProvider` :

```javascript
// src/tools/mon-outil/auth/AppleProvider.svelte.js
import { AuthProvider } from '@/core/auth/AuthProvider.svelte.js'

export class AppleProvider extends AuthProvider {
  constructor(config) {
    super('apple', 'Apple ID', config)
    this.authUrl = 'https://appleid.apple.com/auth/authorize'
    this.tokenUrl = 'https://appleid.apple.com/auth/token'
  }

  requiredConfigKeys() {
    return ['clientId', 'clientSecret', 'redirectUri']
  }

  async login() {
    // Implémentation du flow OAuth Apple
  }

  async refreshToken(refreshToken) {
    // Implémentation du refresh pour Apple
  }
}

// Enregistrement dans l'outil
import { authStore } from '@/stores/authStore.svelte.js'

const appleConfig = {
  clientId: import.meta.env.VITE_APPLE_CLIENT_ID,
  clientSecret: import.meta.env.VITE_APPLE_CLIENT_SECRET,
  redirectUri: import.meta.env.VITE_APPLE_REDIRECT_URI
}

if (appleConfig.clientId) {
  authStore.registerProvider(new AppleProvider(appleConfig))
}
```

## Bonnes Pratiques

### Sécurité

1. **Tokens en mémoire** : Les tokens ne sont stockés qu'en localStorage pour la persistance
2. **PKCE** : Utilisation systématique de PKCE pour le flow OAuth
3. **State validation** : Validation du paramètre state pour éviter CSRF
4. **Auto-refresh** : Refresh automatique des tokens avant expiration

### Performance

1. **Lazy loading** : Les providers ne sont initialisés qu'à la première utilisation
2. **Caching** : Réutilisation des tokens valides
3. **Debouncing** : Évitement des refreshs multiples simultanés

### Debugging

```javascript
// Activation des logs détaillés
eventBus.setDebugMode(true)

// Les événements auth sont loggés automatiquement :
// auth:provider-registered
// auth:login-success / auth:login-error
// auth:token-updated / auth:token-expired
// auth:logout / auth:session-expired
```

## Événements Disponibles

| Événement | Données | Description |
|-----------|---------|-------------|
| `auth:provider-registered` | `{providerId, providerName}` | Provider enregistré |
| `auth:login-success` | `{provider, user}` | Connexion réussie |
| `auth:login-error` | `{provider, error}` | Erreur de connexion |
| `auth:token-updated` | `{accessToken, userInfo, expiry}` | Token mis à jour |
| `auth:token-expired` | `{}` | Token expiré |
| `auth:refresh-needed` | `{refreshToken}` | Refresh nécessaire |
| `auth:logout` | `{}` | Déconnexion |
| `auth:session-expired` | `{}` | Session expirée |

## Limitations Connues

1. **Popup blockers** : Le flow OAuth redirige la page entière (pas de popup)
2. **CORS** : Certains providers peuvent nécessiter une configuration CORS côté serveur
3. **Storage** : Utilisation de localStorage (pas de support offline avancé)
