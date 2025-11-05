# Architecture de l'IDE Svelte

Ce document décrit l'architecture fondamentale du framework d'IDE basé sur Svelte 5. Il est destiné aux développeurs qui souhaitent comprendre le fonctionnement interne du système et créer leurs propres outils.

## Le Concept Fondamental : IDE vs Outils

L'architecture repose sur une **séparation stricte** entre le **cœur de l'IDE** et les **Outils**.

-   **L'IDE** : C'est la coquille, le conteneur. Il ne connaît aucune fonctionnalité métier spécifique. Ses seules responsabilités sont de :
    1.  Fournir une structure d'interface (panneaux, barres d'outils, onglets).
    2.  Gérer l'état global de l'application (quel outil est actif, quels onglets sont ouverts, etc.).
    3.  Exposer des services (API) que les outils peuvent consommer (ex: "ajoute un onglet", "envoie une notification").
    4.  Enregistrer les outils fournis au démarrage (prop `externalTools`, injection du point d'entrée applicatif, etc.) via le `ToolManager`.

-   **Les Outils** : Ce sont des modules indépendants et isolés qui implémentent des fonctionnalités spécifiques (par exemple, un explorateur de fichiers, un terminal, une calculatrice).
    1.  Ils sont "ignorants" de l'architecture globale de l'IDE.
    2.  Ils consomment les services fournis par l'IDE pour s'intégrer à l'interface.
    3.  Un outil peut être ajouté ou supprimé sans jamais casser le cœur de l'IDE, qu'il soit chargé depuis `src/test_tools` (racine configurée) ou injecté via le point d'entrée applicatif.

Cette séparation garantit une **modularité** et une **extensibilité** maximales.

---

## Structure du Projet

Les responsabilités sont clairement délimitées par la structure des dossiers :

-   `src/core/` : Le moteur de l'IDE. Contient les classes et services de base.
    -   Sous-dossier `layout/` : Registre des zones et configuration du chrome.
-   `src/stores/` : L'état global et réactif de l'application.
-   `src/components/layout/` : Les composants Svelte qui constituent l'interface de l'IDE.
-   `src/test_tools/` : Le répertoire où les développeurs créent leurs propres outils pour le développement local (agrégés via `src/test_tools/devExternalTools.js`).
-   `App.svelte` : Le composant racine qui assemble l'application.

---

## Détail des Composants Clés

### 1. `src/stores/ideStore.svelte.js` : Le Cerveau de l'Application

C'est le fichier le plus important pour comprendre le fonctionnement de l'IDE. Il agit comme la **source unique de vérité** pour l'ensemble de l'application.

-   **Rôle** : Il centralise tout l'état réactif de l'IDE en utilisant les "runes" de Svelte 5 (`$state`, `$derived`).
-   **État géré** :
    -   La liste de tous les outils enregistrés (`tools`).
    -   Les regroupements d'outils par position (`topLeftTools`, `bottomLeftTools`, `topRightTools`, `bottomRightTools`, `bottomTools`).
    -   La liste des onglets ouverts dans la vue principale (`tabs`).
    -   L'onglet actuellement actif (`activeTab`).
    -   Les notifications, les logs de la console, l'état de l'utilisateur, etc.
-   **API pour les Outils** : Il expose des méthodes qui forment l'API principale pour les outils. Par exemple :
    -   `ideStore.addTab(...)` : Pour qu'un outil ouvre un nouvel onglet.
    -   `ideStore.addNotification(...)` : Pour afficher une notification.
    -   `ideStore.addLog(...)` : Pour écrire dans la console système.
    -   `ideStore.moveTool(...)` : Pour déplacer un outil entre les zones d'affichage.
    -   Toutes les opérations sur les onglets (activation, splits, fermeture) s'appuient sur `layoutService`, garantissant un layout cohérent quelle que soit la complexité de l'interface.

 Le store expose également `panelsManager`, utilisé pour l'ouverture, la fermeture, le focus et le déplacement des panneaux via les identifiants (`panelId`) attribués à chaque outil par `ToolManager`.

**Un développeur d'outils interagira principalement avec `ideStore` pour intégrer son outil à l'IDE.**

### 2. Le Bus d'Événements (`eventBus`)

Pour la communication découplée entre les outils, ou entre l'IDE et les outils.

-   **Principe :** Un composant publie un événement sans savoir qui écoute. D'autres composants s'abonnent à cet événement et réagissent.
-   **Publier un événement :**
    ```javascript
    import { eventBus } from '@/core/EventBusService.svelte.js';
    eventBus.publish('mon-evenement:nom', { maData: 'valeur' });
    ```
-   **S'abonner à un événement (Exemple dans un composant Svelte) :**
    ```javascript
    $effect(() => {
      const unsubscribe = eventBus.subscribe('mon-evenement:nom', (data) => {
        // Mettre à jour un $state ici pour la réactivité
        console.log('Événement reçu:', data);
      });

      // OBLIGATOIRE: Nettoyer l'abonnement à la destruction du composant
      return () => unsubscribe();
    });
    ```
-   **Débogage :** Activez le mode debug via `eventBus.setDebugMode(true)` pour voir tous les événements et leurs données passer dans la console du navigateur.

### 3. `src/core/` : Les Classes de Base et Services

Ce dossier contient la logique "métier" de l'IDE lui-même.

-   `Tool.svelte.js` : La classe de base que tous les outils doivent étendre. Elle définit les propriétés fondamentales d'un outil : `id`, `name`, `icon`, `position`, et son état `active`.
-   `ToolManager.svelte.js` : Le service responsable du chargement des outils. Au démarrage de l'application, il enregistre l'ensemble des outils fournis (prop `externalTools`, outils injectés par le point d'entrée), appelle leur fonction `register` et attribue un `panelId` stable à chaque outil avant de l'enregistrer auprès du `PanelsManager`.
-   `Tab.svelte.js` : La classe de base pour les onglets, définissant leurs propriétés (ID, titre, composant à rendre, etc.).
-   `GenericLayoutService.svelte.js` : Gestion centralisée des zones du chrome (toolbars, panels) et de leur persistance.
-   `DragDropService.svelte.js` : Service unique gérant le drag & drop entre tabgroups (prévisualisations, zones de drop).
-   `StateProviderService.svelte.js` : Orchestrateur de la persistance multi-services (layout, panneaux, stores spécialisés).

### 4. `src/components/layout/` : L'Interface de l'IDE

Ce dossier contient les composants Svelte qui forment la structure visuelle de l'IDE. Ces composants sont "passifs" : leur rôle est de lire l'état depuis `ideStore` et de l'afficher.

-   `Toolbar.svelte` : Lit la liste des outils depuis `ideStore` et affiche les icônes correspondantes.
-   `ToolPanel.svelte` : Utilise `panelsManager` et les `panelId` fournis par chaque outil pour récupérer et afficher le composant actif de la zone ciblée.
-   `MainView.svelte` et ses sous-composants (`TabBar`, `TabGroupContent`, etc.) consomment directement `layoutService` (et son arbre de tabgroups) pour gérer les splits, le focus global et le drag & drop.

Ces composants ne contiennent aucune logique métier. Ils sont uniquement responsables du rendu de l'état.

### 5. `App.svelte` : Le Point d'Entrée

C'est le composant racine qui assemble toutes les pièces du puzzle.

-   **Initialisation** : Au montage, il instancie les outils système (console, notifications, etc.), les enregistre via `toolManager`, puis charge les outils externes fournis via la prop `externalTools`.
-   **Assemblage de l'interface** : Il intègre tous les composants `layout` (`TitleBar`, `Toolbar`, `MainView`, etc.) pour former l'application complète.
-   **Logique de l'interface globale** : Il gère des interactions qui affectent toute l'interface, comme le redimensionnement des panneaux.

### 6. `LayoutService.svelte.js` : Gestion avancée des onglets

-   Maintient un arbre de layout composé de tabgroups et de containers (splits horizontaux/verticaux).
-   Gère un focus global unique (navigation clavier, synchronisation avec `TabBar`).
-   Fournit toutes les opérations de haut niveau (ajout d'onglet, splits par drag & drop, réordonnancement, fermeture).
-   Automatise la persistance (autosave + restauration) via `stateProviderService`.

### 7. Outils système

Le cœur installe un ensemble réduit d'outils "système" (Console, Notifications, etc.) qui offrent des services transverses à l'IDE. Ils sont enregistrés comme n'importe quel outil mais sont fournis par défaut pour garantir l'expérience de base.

---

## Le Cycle de Vie d'un Outil : Résumé pour le Développeur

1.  **Création** : Le développeur crée un nouveau dossier dans `src/test_tools/mon-outil/`.
2.  **Point d'entrée** : Il crée un fichier `index.svelte.js` qui exporte une fonction `register(toolManager)`.
3.  **Enregistrement** : Dans cette fonction, il instancie son outil (une classe qui hérite de `Tool`) et l'enregistre via `toolManager.registerTool(monOutil)`.
4.  **Composant UI** : Il crée un composant Svelte (`MonOutil.svelte`) qui représente l'interface de son outil.
5.  **Liaison** : Dans la méthode `initialize()` de sa classe d'outil, il lie le composant à l'outil avec `this.setComponent(MonOutil)`.
6.  **Interaction** : Depuis son composant ou sa classe, il peut appeler les méthodes de `ideStore` (ex: `ideStore.addTab(...)`) pour interagir avec le reste de l'IDE.

En suivant ce modèle, l'outil peut être injecté via la prop `externalTools` (comme le fait le point d'entrée de développement) tout en restant complètement découplé du code du cœur.

> ℹ️ Les projets consommateurs peuvent également injecter des outils dynamiquement (ex: `mount(App, { props: { externalTools }})`). L'IDE ne fait aucune hypothèse sur leur provenance tant qu'ils respectent l'API `Tool`.

## Authentification Google OAuth

Deux parcours sont supportés pour l'authentification Google : un flux 100 % SPA à base de PKCE, et un flux hybride où un backend réalise les échanges sensibles. Les deux modes partagent la même API côté IDE ; seul le fichier de configuration change.

### Mode SPA (PKCE pur)
- Prévoir un client OAuth 2.0 configuré pour les applications JavaScript, activer PKCE et ne pas utiliser le `client_secret`.
- Définir `VITE_AUTH_PROVIDERS=google` et `VITE_GOOGLE_CLIENT_ID=<id-oauth>` ; ne pas exposer de secret ni de jeton dans les variables `VITE_`.
- Le frontend échange directement le code d'autorisation en appelant les endpoints Google. Les jetons reçus restent manipulés côté navigateur (cf. tâches #3 pour le durcissement du stockage).
- Toute présence d'un `clientSecret` est bloquée sauf si `VITE_GOOGLE_ALLOW_INSECURE_SECRET=true` est explicitement positionné (usage toléré uniquement en local) afin d'éviter la fuite d'un secret dans le bundle.
- Une option de contournement existe pour le développement (`VITE_GOOGLE_ALLOW_INSECURE_SECRET=true` + `VITE_GOOGLE_CLIENT_SECRET`) : elle injecte le secret dans les appels directs à Google mais doit rester strictement réservée aux environnements non productifs.

### Mode Backend (recommandé)
- Exposer un endpoint serveur (ex: `/api/auth/google/token`) qui reçoit `code`, `codeVerifier`, `redirectUri` et `clientId`, puis effectue l'échange avec Google en utilisant le `client_secret` stocké côté serveur.
- Configurer le frontend avec `VITE_GOOGLE_BACKEND_TOKEN_URL=https://<votre-backend>/api/auth/google/token` et, si besoin, `VITE_GOOGLE_BACKEND_REFRESH_URL` pour le rafraîchissement.
- Le provider enverra automatiquement les requêtes backend avec `credentials: 'include'` pour permettre la mise en place de cookies httpOnly. Ajuster `backendCredentials` ou `backendHeaders` dans le code si un autre comportement est requis.
- Cette approche permet de placer le `client_secret` et la persistance des jetons en zone serveur (cookies httpOnly, base chiffrée, etc.).

### Basculer d'un mode à l'autre
- L'absence d'URL backend fait basculer le provider en mode SPA. Renseigner une URL de backend (ou `VITE_GOOGLE_USE_BACKEND=true`) active automatiquement le mode serveur.
- Aucune modification n’est nécessaire ailleurs dans l’application : `AuthManager` et `authStore` détectent la configuration et utilisent la même API.

### Sécurité des jetons
- La persistance des jetons est contrôlée par `VITE_AUTH_TOKEN_PERSISTENCE` (`memory`, `session`, `local`). Par défaut, on stocke en `sessionStorage`, ou uniquement en mémoire si un backend OAuth est configuré.
- Un chiffrement optionnel au repos est disponible via `VITE_AUTH_TOKEN_ENCRYPTION_KEY` (clé AES-GCM encodée en base64). Quand la clé est absente, l’application retombe sur un stockage en clair.
- Pour auditer les accès, activez `VITE_AUTH_LOG_TOKEN_ACCESSES=true`. Les empreintes sont tronquées (`abcd…wxyz`) pour éviter toute fuite dans la console.
- Lorsque le backend gère des cookies httpOnly, positionnez `VITE_AUTH_TOKEN_PERSISTENCE=memory` afin qu’aucun jeton ne soit conservé dans le navigateur.
- Une politique CSP stricte peut être injectée via `VITE_CSP_DIRECTIVES`. À défaut, une valeur par défaut est appliquée en production pour réduire la surface XSS.
- Les intégrateurs peuvent utiliser directement `applyCsp`, `getTokenSecurityConfig`, `TokenCipher`, `APP_KEY` et `namespacedKey` via l’API publique (`import { … } from 'svelte-ide'`) pour appliquer la même stratégie de sécurité dans leurs outils externes.
- Les traces verbeuses peuvent être activées via `VITE_AUTH_DEBUG_LOGS=true`. Par défaut, seules les erreurs et avertissements sont affichés en production.
- En production (`import.meta.env.PROD`), `VITE_AUTH_PROVIDERS` doit être défini et ne peut contenir `mock`. Le `MockProvider` reste disponible uniquement pour le développement.

## Principes transverses
- Observer en priorité les conventions déjà présentes dans la base de code avant d’appliquer de nouvelles règles
- Respecter la règle de langage : code et noms de fichiers en anglais, commentaires et libellés UI en français
- Favoriser le principe KISS : écrire le minimum de code nécessaire, éviter les couches d'abstraction inutiles et n'introduire qu'une classe ou un module supplémentaire apportant un bénéfice clair
- Écrire et conserver les fichiers en UTF-8 SANS BOM afin de préserver les accents et caractères spéciaux. Les fichiers doivent être encodés avec des "LF". **INTERDIT AU CRLF**, **BOM INTERDIT**
