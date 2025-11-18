# Variables d'Environnement - svelte-ide

Ce guide centralise toutes les variables d'environnement disponibles dans le framework svelte-ide, organisées par fonctionnalité.

> **Note** : Toutes les variables commencent par `VITE_` car elles sont exposées côté client via Vite. Consultez le fichier `.env.example` à la racine du projet pour voir des exemples concrets.

---

## 📋 Table des Matières

1. [Configuration Générale](#configuration-générale)
2. [Authentification OAuth](#authentification-oauth)
3. [Persistance IndexedDB](#persistance-indexeddb)
4. [Sécurité et Chiffrement](#sécurité-et-chiffrement)
5. [Logging et Debug](#logging-et-debug)
6. [Variables Avancées](#variables-avancées)

---

## Configuration Générale

### `VITE_APP_URL`
- **Type** : `string`
- **Défaut** : `http://localhost:5173`
- **Description** : URL de base de l'application, utilisée pour générer les redirections OAuth
- **Exemple** :
  ```bash
  VITE_APP_URL=https://my-app.example.com
  ```

### `VITE_APP_KEY`
- **Type** : `string`
- **Défaut** : `svelte-ide`
- **Description** : Clé unique pour namespacing (localStorage, derivation de clés). **Changer cette valeur pour chaque projet client.**
- **Exemple** :
  ```bash
  VITE_APP_KEY=my-company-ide
  ```

---

## Authentification OAuth

### `VITE_AUTH_PROVIDERS`
- **Type** : `string` (liste séparée par virgules)
- **Défaut** : `mock` (développement) ou **obligatoire en production**
- **Valeurs possibles** : `google`, `azure`, `mock`
- **Description** : Liste des providers OAuth activés. En production, `mock` est interdit.
- **Exemple** :
  ```bash
  # Développement
  VITE_AUTH_PROVIDERS=mock
  
  # Production avec Google et Azure
  VITE_AUTH_PROVIDERS=google,azure
  ```

---

### Providers Spécifiques

#### Google OAuth

##### `VITE_GOOGLE_CLIENT_ID`
- **Type** : `string`
- **Obligatoire** : Oui (si `google` dans `VITE_AUTH_PROVIDERS`)
- **Description** : Client ID OAuth 2.0 de Google Cloud Console
- **Exemple** :
  ```bash
  VITE_GOOGLE_CLIENT_ID=123456789-abcdefg.apps.googleusercontent.com
  ```

##### `VITE_GOOGLE_CLIENT_SECRET`
- **Type** : `string`
- **Obligatoire** : Non (mode SPA PKCE) ou Oui (mode backend)
- **⚠️ Sécurité** : Ne jamais exposer en production frontend! Utiliser uniquement avec `VITE_GOOGLE_ALLOW_INSECURE_SECRET=true` en développement local.
- **Description** : Client secret pour échange de tokens côté serveur
- **Exemple** :
  ```bash
  # ❌ NE PAS FAIRE en production
  # ✅ OK uniquement en dev avec flag explicite
  VITE_GOOGLE_CLIENT_SECRET=GOCSPX-xxxxxxxxxxxxxxxx
  VITE_GOOGLE_ALLOW_INSECURE_SECRET=true
  ```

##### `VITE_GOOGLE_REDIRECT_URI`
- **Type** : `string`
- **Défaut** : `${VITE_APP_URL}/auth/callback`
- **Description** : URI de redirection après authentification Google
- **Exemple** :
  ```bash
  VITE_GOOGLE_REDIRECT_URI=https://my-app.com/auth/callback
  ```

##### `VITE_GOOGLE_BACKEND_TOKEN_URL`
- **Type** : `string`
- **Obligatoire** : Non (active mode backend si présent)
- **Description** : URL backend pour échanger le code d'autorisation en tokens (recommandé pour production)
- **Exemple** :
  ```bash
  VITE_GOOGLE_BACKEND_TOKEN_URL=https://api.my-app.com/auth/google/token
  ```

##### `VITE_GOOGLE_BACKEND_REFRESH_URL`
- **Type** : `string`
- **Obligatoire** : Non
- **Description** : URL backend pour rafraîchir les tokens (si différent de token URL)
- **Exemple** :
  ```bash
  VITE_GOOGLE_BACKEND_REFRESH_URL=https://api.my-app.com/auth/google/refresh
  ```

##### `VITE_GOOGLE_USE_BACKEND`
- **Type** : `boolean`
- **Défaut** : `false`
- **Description** : Force l'utilisation du mode backend même sans URL backend configurée
- **Exemple** :
  ```bash
  VITE_GOOGLE_USE_BACKEND=true
  ```

##### `VITE_GOOGLE_ALLOW_INSECURE_SECRET`
- **Type** : `boolean`
- **Défaut** : `false`
- **⚠️ Sécurité** : **Développement uniquement!** Permet d'exposer le `client_secret` côté frontend.
- **Description** : Autorise l'utilisation du client secret en mode SPA (dangereux)
- **Exemple** :
  ```bash
  # ⚠️ DÉVELOPPEMENT LOCAL UNIQUEMENT
  VITE_GOOGLE_ALLOW_INSECURE_SECRET=true
  ```

#### Azure AD OAuth

##### `VITE_AZURE_CLIENT_ID`
- **Type** : `string`
- **Obligatoire** : Oui (si `azure` dans `VITE_AUTH_PROVIDERS`)
- **Description** : Application (client) ID depuis Azure Portal
- **Exemple** :
  ```bash
  VITE_AZURE_CLIENT_ID=12345678-1234-1234-1234-123456789abc
  ```

##### `VITE_AZURE_TENANT_ID`
- **Type** : `string`
- **Obligatoire** : Oui (si `azure` dans `VITE_AUTH_PROVIDERS`)
- **Description** : Directory (tenant) ID depuis Azure Portal
- **Exemple** :
  ```bash
  VITE_AZURE_TENANT_ID=87654321-4321-4321-4321-abcdef123456
  ```

##### `VITE_AZURE_REDIRECT_URI`
- **Type** : `string`
- **Défaut** : `${VITE_APP_URL}/auth/callback`
- **Description** : URI de redirection enregistrée dans Azure
- **Exemple** :
  ```bash
  VITE_AZURE_REDIRECT_URI=https://my-app.com/auth/callback
  ```

---

### Gestion des Tokens

#### `VITE_MOCK_JWT_SECRET`
- **Type** : `string`
- **Défaut** : `default-dev-secret-change-in-production`
- **Description** : Secret partagé pour signer les JWT générés par MockProvider (HS256). Le backend doit utiliser le même secret dans sa variable `MOCK_JWT_SECRET`.
- **Usage** : En développement avec MockProvider, permet de tester le flux de validation JWT comme avec un vrai provider.
- **Sécurité** : Changer cette valeur pour chaque environnement. Les deux secrets (frontend/backend) doivent être identiques.
- **Exemple** :
  ```bash
  # Frontend (.env.development)
  VITE_MOCK_JWT_SECRET=my-shared-dev-secret-123
  
  # Backend (.env)
  MOCK_JWT_SECRET=my-shared-dev-secret-123
  ```

#### `VITE_MOCK_AUTH_DELAY`
- **Type** : `number`
- **Défaut** : `1000` (millisecondes)
- **Description** : Délai simulé pour les opérations MockProvider (login, refresh, logout) pour tester l'UX de chargement
- **Exemple** :
  ```bash
  # Pas de délai (tests rapides)
  VITE_MOCK_AUTH_DELAY=0
  
  # Délai réaliste (simule réseau)
  VITE_MOCK_AUTH_DELAY=1500
  ```

#### `VITE_AUTH_TOKEN_PERSISTENCE`
- **Type** : `string`
- **Défaut** : `session` (ou `memory` si backend OAuth configuré)
- **Valeurs possibles** : `memory`, `session`, `local`
- **Description** : Stratégie de persistance des tokens d'accès
  - `memory` : Tokens perdus au rechargement (recommandé avec backend OAuth)
  - `session` : Tokens persistent pendant la session du navigateur
  - `local` : Tokens persistent après fermeture du navigateur
- **Exemple** :
  ```bash
  # Sécurité maximale (backend gère cookies httpOnly)
  VITE_AUTH_TOKEN_PERSISTENCE=memory
  
  # Équilibre (défaut)
  VITE_AUTH_TOKEN_PERSISTENCE=session
  
  # Persistance longue durée
  VITE_AUTH_TOKEN_PERSISTENCE=local
  ```

#### `VITE_AUTH_REFRESH_TOKEN_PERSISTENCE`
- **Type** : `string`
- **Défaut** : `local` (mode SPA) ou `memory` (mode backend)
- **Valeurs possibles** : `memory`, `session`, `local`
- **Description** : Stratégie de persistance du refresh token (permet auto-refresh)
- **Exemple** :
  ```bash
  # Backend gère refresh via cookies
  VITE_AUTH_REFRESH_TOKEN_PERSISTENCE=memory
  
  # SPA avec refresh automatique après fermeture
  VITE_AUTH_REFRESH_TOKEN_PERSISTENCE=local
  ```

#### `VITE_AUTH_TOKEN_ENCRYPTION_KEY`
- **Type** : `string` (base64)
- **Obligatoire** : Non
- **Description** : Clé AES-GCM (256 bits) pour chiffrer les tokens au repos dans `localStorage`/`sessionStorage`. Si absente, stockage en clair.
- **Génération** :
  ```javascript
  // Dans la console navigateur ou Node.js
  const key = await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  )
  const exported = await crypto.subtle.exportKey('raw', key)
  const base64Key = btoa(String.fromCharCode(...new Uint8Array(exported)))
  console.log(base64Key)
  ```
- **Exemple** :
  ```bash
  VITE_AUTH_TOKEN_ENCRYPTION_KEY=abcdefghijklmnopqrstuvwxyz0123456789ABCD==
  ```

#### `VITE_AUTH_LOG_TOKEN_ACCESSES`
- **Type** : `boolean`
- **Défaut** : `false`
- **Description** : Active le logging des accès tokens (empreintes tronquées) pour audit
- **Exemple** :
  ```bash
  VITE_AUTH_LOG_TOKEN_ACCESSES=true
  ```

#### `VITE_AUTH_DEBUG_LOGS`
- **Type** : `boolean`
- **Défaut** : `false` (production) ou `true` (développement)
- **Description** : Active les logs verbeux de l'authentification (refresh, expiration, etc.)
- **Exemple** :
  ```bash
  VITE_AUTH_DEBUG_LOGS=true
  ```

---

## Persistance IndexedDB

### `VITE_INDEXEDDB_FALLBACK_STRATEGY`
- **Type** : `string`
- **Défaut** : `block`
- **Valeurs possibles** : `block`, `localStorage`, `memory`
- **Description** : Stratégie si IndexedDB indisponible (navigation privée, ancien navigateur)
  - `block` : Bloque l'application avec erreur (défaut, recommandé pour sécurité)
  - `localStorage` : Fallback non chiffré avec warning (limité 5-10MB)
  - `memory` : Fallback temporaire, données perdues au rechargement
- **Exemple** :
  ```bash
  # Production : bloquer pour forcer IndexedDB
  VITE_INDEXEDDB_FALLBACK_STRATEGY=block
  
  # Développement : permettre localStorage
  VITE_INDEXEDDB_FALLBACK_STRATEGY=localStorage
  
  # Tests : mode éphémère
  VITE_INDEXEDDB_FALLBACK_STRATEGY=memory
  ```

### `VITE_INDEXEDDB_ENCRYPTION_KEY`
- **Type** : `string` (base64)
- **Obligatoire** : Non (clé dérivée depuis `userInfo.sub` par défaut)
- **Description** : Clé AES-GCM fixe pour chiffrer IndexedDB. **Attention** : utiliser uniquement pour tests/développement. En production, la clé est dérivée automatiquement depuis l'ID utilisateur OAuth.
- **Exemple** :
  ```bash
  # ⚠️ DÉVELOPPEMENT UNIQUEMENT
  VITE_INDEXEDDB_ENCRYPTION_KEY=your_base64_aes_key_here==
  ```

### `VITE_STORAGE_PERSISTENCE_REQUEST`
- **Type** : `boolean`
- **Défaut** : `true` (activé par défaut)
- **Description** : Active la demande automatique de persistance durable au démarrage via `navigator.storage.persist()`. Cela protège les données contre la suppression automatique par le navigateur (mode "best-effort").
  - `true` ou **non défini** : Demande automatiquement la persistance durable (recommandé pour applications critiques)
  - `false` : Pas de demande automatique, mode best-effort (données peuvent être évincées)
- **Impact** :
  - **Avec persistance** : Données protégées contre l'éviction automatique, persistance garantie
  - **Sans persistance** : Navigateur peut supprimer les données silencieusement après quelques jours/semaines
- **Exemple** :
  ```bash
  # Production : activer (par défaut, peut être omis)
  VITE_STORAGE_PERSISTENCE_REQUEST=true
  
  # Tests éphémères : désactiver explicitement
  VITE_STORAGE_PERSISTENCE_REQUEST=false
  
  # Omis dans .env : comportement par défaut = activé
  # (pas besoin de définir la variable)
  ```
- **Note** : Voir [_DOCS/STORAGE_PERSISTENCE.md](_DOCS/STORAGE_PERSISTENCE.md) pour plus de détails sur l'éviction automatique des données

---

## Sécurité et Chiffrement

### `VITE_CSP_DIRECTIVES`
- **Type** : `string` (format CSP)
- **Obligatoire** : Non (défaut appliqué en production)
- **Description** : Content Security Policy personnalisée. Par défaut en production :
  ```
  default-src 'self';
  script-src 'self' 'unsafe-inline';
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: https:;
  font-src 'self' data:;
  connect-src 'self' https://accounts.google.com https://oauth2.googleapis.com https://login.microsoftonline.com
  ```
- **Exemple** :
  ```bash
  VITE_CSP_DIRECTIVES="default-src 'self'; script-src 'self' 'unsafe-eval'; connect-src 'self' https://api.example.com"
  ```

---

## Logging et Debug

### `VITE_LOG_NAMESPACES`
- **Type** : `string` (liste séparée par virgules)
- **Défaut** : *(vide)* → aucun logger applicatif n'émet (silence complet par défaut)
- **Description** : Filtre les loggers applicatifs (`createLogger('namespace')`). chaque token est comparé (insensible à la casse) au namespace enregistré, ce qui permet d'activer des zones précises (`components/ui/generic-element-tree`, `core/auth`, etc.).
- **Valeurs spéciales** :
  - `*` : active toutes les sorties (utile pendant le dev)
- **Exemples** :
  ```bash
  # Ne loguer que les modules GenericElementTree et persistance
  VITE_LOG_NAMESPACES=generic-element-tree,core/persistence

  # Afficher absolument tous les logs applicatifs
  VITE_LOG_NAMESPACES=*
  ```
- **Compatibilité** : `VITE_MODLOG` est désormais déprécié mais reste pris en charge comme alias.
- **Documentation complète** : Voir [_DOCS/LOGGER_QUICKSTART.md](../_DOCS/LOGGER_QUICKSTART.md) pour l'usage du système de logging dans vos outils.

### `VITE_LOG_LEVEL`
- **Type** : `string` (`debug`, `info`, `warn`, `error`)
- **Défaut** : `debug` en développement, `info` en production
- **Description** : Définit le niveau minimum global utilisé par le service de logs (`debug` affiche tout, `warn` ne garde que les avertissements/erreurs, etc.).
- **Exemples** :
  ```bash
  VITE_LOG_LEVEL=warn
  ```

### `VITE_AUTH_DEBUG_LOGS`
*(Déjà documenté dans section Authentification OAuth)*

### `VITE_AUTH_LOG_TOKEN_ACCESSES`
*(Déjà documenté dans section Authentification OAuth)*

### `VITE_EVENT_BUS_DEBUG`
- **Type** : `boolean`
- **Défaut** : `false`
- **Description** : Active le mode debug de l'EventBus (tous les événements loggés)
- **Exemple** :
  ```bash
  VITE_EVENT_BUS_DEBUG=true
  ```
- **Usage programmatique** :
  ```javascript
  import { eventBus } from 'svelte-ide'
  eventBus.setDebugMode(true)
  ```

---

## Variables Avancées

### `VITE_INDEXEDDB_DB_NAME`
- **Type** : `string`
- **Défaut** : `svelte-ide-db`
- **Description** : Nom de la base IndexedDB (utile pour multi-instances)
- **Exemple** :
  ```bash
  VITE_INDEXEDDB_DB_NAME=my-custom-db
  ```

### `VITE_INDEXEDDB_DB_VERSION`
- **Type** : `number`
- **Défaut** : `1`
- **Description** : Version du schéma IndexedDB (incrémente pour migrations)
- **Exemple** :
  ```bash
  VITE_INDEXEDDB_DB_VERSION=2
  ```

---

## 📝 Fichier `.env.example` Complet

Voici un exemple complet avec toutes les variables documentées :

```bash
# ==========================================
# CONFIGURATION GÉNÉRALE
# ==========================================
VITE_APP_URL=http://localhost:5173
VITE_APP_KEY=svelte-ide

# ==========================================
# AUTHENTIFICATION OAUTH
# ==========================================
# Providers activés (mock, google, azure)
VITE_AUTH_PROVIDERS=google,azure

# --- Mock Provider (développement) ---
# Secret partagé pour signature JWT (doit matcher le backend)
VITE_MOCK_JWT_SECRET=my-shared-dev-secret
# Délai simulé en ms (0 = instantané)
VITE_MOCK_AUTH_DELAY=1000

# --- Google OAuth ---
VITE_GOOGLE_CLIENT_ID=your_google_client_id_here
VITE_GOOGLE_REDIRECT_URI=http://localhost:5173/auth/callback

# Mode Backend (recommandé production)
# VITE_GOOGLE_BACKEND_TOKEN_URL=https://api.my-app.com/auth/google/token
# VITE_GOOGLE_BACKEND_REFRESH_URL=https://api.my-app.com/auth/google/refresh

# Mode SPA avec client_secret (⚠️ DEV UNIQUEMENT)
# VITE_GOOGLE_CLIENT_SECRET=your_client_secret_here
# VITE_GOOGLE_ALLOW_INSECURE_SECRET=true

# --- Azure AD OAuth ---
VITE_AZURE_CLIENT_ID=your_azure_client_id_here
VITE_AZURE_TENANT_ID=your_azure_tenant_id_here
VITE_AZURE_REDIRECT_URI=http://localhost:5173/auth/callback

# --- Gestion des Tokens ---
# Persistance : memory | session | local
VITE_AUTH_TOKEN_PERSISTENCE=session
VITE_AUTH_REFRESH_TOKEN_PERSISTENCE=local

# Chiffrement tokens au repos (optionnel)
# VITE_AUTH_TOKEN_ENCRYPTION_KEY=your_base64_aes_key_here==

# Audit et debug
# VITE_AUTH_LOG_TOKEN_ACCESSES=true
# VITE_AUTH_DEBUG_LOGS=true

# ==========================================
# PERSISTANCE INDEXEDDB
# ==========================================
# Stratégie fallback : block | localStorage | memory
VITE_INDEXEDDB_FALLBACK_STRATEGY=block

# Nom et version de la base
# VITE_INDEXEDDB_DB_NAME=svelte-ide-db
# VITE_INDEXEDDB_DB_VERSION=1

# Clé chiffrement fixe (⚠️ DEV UNIQUEMENT, sinon dérivée de userInfo.sub)
# VITE_INDEXEDDB_ENCRYPTION_KEY=your_base64_aes_key_here==

# ==========================================
# SÉCURITÉ
# ==========================================
# Content Security Policy personnalisée (optionnel)
# VITE_CSP_DIRECTIVES="default-src 'self'; script-src 'self' 'unsafe-inline'"

# ==========================================
# DEBUG
# ==========================================
# VITE_EVENT_BUS_DEBUG=true
```

---

## 🔐 Bonnes Pratiques de Sécurité

### Production

#### ✅ À FAIRE
```bash
# Providers réels uniquement
VITE_AUTH_PROVIDERS=google,azure

# Mode backend pour tokens
VITE_GOOGLE_BACKEND_TOKEN_URL=https://api.example.com/auth/google/token
VITE_AUTH_TOKEN_PERSISTENCE=memory

# Bloquer si IndexedDB indisponible
VITE_INDEXEDDB_FALLBACK_STRATEGY=block

# Chiffrement tokens au repos
VITE_AUTH_TOKEN_ENCRYPTION_KEY=<clé générée aléatoirement>

# CSP stricte
VITE_CSP_DIRECTIVES="default-src 'self'; ..."
```

#### ❌ À ÉVITER
```bash
# ❌ Mock provider en production
VITE_AUTH_PROVIDERS=mock

# ❌ Client secret exposé frontend
VITE_GOOGLE_CLIENT_SECRET=xxx
VITE_GOOGLE_ALLOW_INSECURE_SECRET=true

# ❌ Persistance locale sans chiffrement
VITE_AUTH_TOKEN_PERSISTENCE=local
# (sans VITE_AUTH_TOKEN_ENCRYPTION_KEY)

# ❌ Fallback localStorage non chiffré
VITE_INDEXEDDB_FALLBACK_STRATEGY=localStorage
```

### Développement

```bash
# Mock pour tests rapides avec JWT signés
VITE_AUTH_PROVIDERS=mock
VITE_MOCK_JWT_SECRET=my-dev-secret-123
VITE_MOCK_AUTH_DELAY=500

# Ou Google avec secret (flag explicite)
VITE_AUTH_PROVIDERS=google
VITE_GOOGLE_CLIENT_SECRET=xxx
VITE_GOOGLE_ALLOW_INSECURE_SECRET=true

# Persistance session pour debug
VITE_AUTH_TOKEN_PERSISTENCE=session

# Fallback localStorage acceptable
VITE_INDEXEDDB_FALLBACK_STRATEGY=localStorage

# Logs verbeux
VITE_AUTH_DEBUG_LOGS=true
VITE_EVENT_BUS_DEBUG=true
```

---

## 🚀 Configuration par Environnement

### Fichiers `.env` Multiples

Vite supporte plusieurs fichiers `.env` selon le mode :

```bash
.env                # Toujours chargé
.env.local          # Toujours chargé, ignoré par git
.env.development    # Mode development uniquement
.env.production     # Mode production uniquement
```

**Exemple** :
```bash
# .env.development
VITE_AUTH_PROVIDERS=mock
VITE_INDEXEDDB_FALLBACK_STRATEGY=localStorage
VITE_AUTH_DEBUG_LOGS=true

# .env.production
VITE_AUTH_PROVIDERS=google,azure
VITE_GOOGLE_BACKEND_TOKEN_URL=https://api.prod.com/auth/google/token
VITE_INDEXEDDB_FALLBACK_STRATEGY=block
VITE_AUTH_TOKEN_PERSISTENCE=memory
```

### Accès Programmatique

```javascript
// Dans le code Svelte/JavaScript
const appUrl = import.meta.env.VITE_APP_URL
const isProd = import.meta.env.PROD
const isDev = import.meta.env.DEV

// Vérifier si variable définie
if (!import.meta.env.VITE_GOOGLE_CLIENT_ID) {
  console.error('VITE_GOOGLE_CLIENT_ID requis')
}
```

---

## 📚 Références

- [Configuration Vite](https://vitejs.dev/guide/env-and-mode.html)
- [Guide Authentification OAuth](./AUTHENTICATION.md)
- [Guide Persistance IndexedDB](./INDEXEDDB_USAGE.md)
- [Configuration Sécurité CSP](../src/core/security/csp.svelte.js)

---

**Dernière mise à jour** : 7 novembre 2025
