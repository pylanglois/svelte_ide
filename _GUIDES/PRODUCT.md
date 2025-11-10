# Vision Produit : svelte-ide

## Vue d'ensemble

**svelte-ide** est un framework modulaire pour la création d'environnements de développement intégrés (IDE) et d'applications complexes basées sur des outils extensibles. Construit avec Svelte 5 et ses runes modernes, le framework offre une architecture robuste qui sépare strictement le cœur de l'application des fonctionnalités métier.

## Vision

Fournir une **coquille IDE universelle** qui permet aux développeurs de créer rapidement des applications riches en fonctionnalités sans réinventer l'infrastructure de base. Le framework gère la complexité de la gestion d'état, de la persistance, de l'authentification et de l'interface utilisateur, permettant aux équipes de se concentrer sur la valeur métier de leurs outils.

## Objectifs Business

### Pour les Développeurs de Frameworks
- **Réutilisabilité** : Une base solide pour créer plusieurs applications IDE sans dupliquer l'infrastructure
- **Maintenabilité** : Architecture claire avec séparation des responsabilités
- **Évolutivité** : Ajout de nouvelles fonctionnalités sans risque de régression

### Pour les Intégrateurs
- **Time-to-Market Réduit** : Infrastructure prête à l'emploi pour lancer rapidement des prototypes
- **Extensibilité Sans Limites** : Système de plugins permettant d'ajouter des outils métier spécifiques
- **Expérience Utilisateur Cohérente** : Chrome unifié (menus, barres d'outils, panneau de statut)

### Pour les Utilisateurs Finaux
- **Personnalisation** : Layout adaptable avec persistance par utilisateur
- **Authentification Intégrée** : Support OAuth (Google, Azure) avec gestion sécurisée des tokens
- **Performance** : Réactivité native de Svelte 5 pour une expérience fluide

## Cas d'Usage Cibles

### 1. Applications de Gestion de Données
Un outil de gestion de transactions financières peut utiliser le framework pour :
- Afficher des listes de transactions (outil `transactions`)
- Naviguer dans des hiérarchies de comptes (outil `explorer`)
- Visualiser des graphiques (outil `charts`)
- Persister le layout et les préférences par utilisateur

### 2. Environnements de Développement Métier
Une entreprise peut créer un IDE spécialisé pour :
- Éditer des configurations métier (outil `editor`)
- Valider des règles business (outil `validator`)
- Tester des scénarios (outil `tester`)
- Intégrer avec des APIs internes (outils personnalisés)

### 3. Dashboards Analytiques
Un dashboard de BI peut exploiter le framework pour :
- Organiser des widgets analytiques (outils `charts`, `tables`, `kpi`)
- Permettre le drag & drop des panneaux
- Sauvegarder des configurations de vues par projet
- Partager des layouts entre équipes

### 4. Outils Internes d'Entreprise
Des outils admin peuvent bénéficier de :
- L'authentification centralisée (SSO via OAuth)
- La gestion de permissions par outil
- L'interface standardisée réduisant la courbe d'apprentissage
- La persistance des préférences utilisateur

## Fonctionnalités Phares

### Cœur du Framework

#### 1. Architecture Modulaire
- **Séparation IDE/Outils** : Le cœur ne connaît aucune logique métier
- **ToolManager** : Enregistrement et cycle de vie des outils
- **PanelsManager** : Gestion des zones d'affichage (topLeft, bottomRight, etc.)
- **API Publique** : Exports clairs via `public-api.js`

#### 2. Gestion d'État Avancée
- **ideStore** : Source unique de vérité pour l'état global
- **layoutService** : Arbre de layout avec tabgroups et splits
- **Réactivité Svelte 5** : Runes (`$state`, `$effect`, `$derived`) pour une réactivité fine
- **Persistance Multi-Niveaux** : StateProviderService orchestrant la sauvegarde

#### 3. Système de Layout Dynamique
- **Splits Horizontaux/Verticaux** : Division de l'espace en sous-zones
- **Drag & Drop** : Réorganisation des onglets entre tabgroups
- **Focus Global** : Navigation clavier synchronisée
- **Persistance Automatique** : Sauvegarde du layout par utilisateur

#### 4. Authentification & Sécurité
- **OAuth Multi-Providers** : Google, Azure (extensible)
- **Flux PKCE** : Support SPA pur ou backend hybride
- **Gestion des Tokens** : Auto-refresh, chiffrement optionnel AES-GCM
- **Politique CSP** : Durcissement contre les attaques XSS

#### 5. Services Transverses
- **EventBus** : Communication découplée entre outils
- **MainMenuService** : Menus dynamiques enregistrés par les outils
- **StatusBarService** : Composants personnalisables (horloge, fichier actif, etc.)
- **ModalService** : Dialogues modaux avec confirmation
- **ContextMenuService** : Menus contextuels réactifs
- **Persistence Signals** : Événements `persistence:ready` / `persistence:error` et promesse `indexedDBService.readyForEncryption()` pour coordonner le chiffrement IndexedDB/BinaryStorage.
- **Hydration Hooks** : Événements `hydration:before` / `hydration:after` garantissant que les `stateProviders` sont restaurés avant l'hydratation des onglets.

#### 6. Outils Système Intégrés
- **Console** : Logs multi-onglets avec filtres par type
- **Notifications** : Centre de notifications avec compteur de non-lus
- **Explorateur de Fichiers** : Exemple d'outil avec gestion de contenu

### Extensibilité

#### Pour les Développeurs d'Outils
- **Classe de Base `Tool`** : Héritage simple pour créer un outil
- **Méthode `initialize()`** : Hook de configuration
- **Méthode `setComponent()`** : Liaison du composant Svelte
- **Props `position`, `visibilityMode`** : Contrôle de l'affichage
- **Injection de Dépendances** : Accès à `ideStore`, `eventBus`, etc.

#### Exemples d'Outils Fournis
- **Calculator** : Calculatrice simple démontrant l'UI basique
- **Explorer/Explorer2** : Navigation de fichiers avec métadonnées
- **Transactions** : Gestion de transactions avec comptes et catégories

## Principes de Conception

### 1. Principe KISS (Keep It Simple, Stupid)
- Pas de couches d'abstraction inutiles
- Une classe ou un service ne doit exister que s'il apporte un bénéfice clair
- Code minimal nécessaire pour réaliser une fonctionnalité

### 2. Convention sur Configuration
- Structure de dossiers standardisée (`src/core/`, `src/stores/`, `src/components/layout/`)
- Nomenclature cohérente (anglais pour le code, français pour les UI/commentaires)
- Exports via `public-api.js` pour une surface d'API claire

### 3. Isolation et Découplage
- Les outils ne se connaissent pas entre eux
- Communication via `eventBus` ou `ideStore` uniquement
- Pas de dépendances directes entre outils

### 4. Performance et Scalabilité
- Registres avec `Map` pour O(1)
- Lazy loading des composants quand possible
- Batch des sauvegardes avec priorités
- Réactivité fine de Svelte 5 pour éviter les re-rendus inutiles

## Roadmap

### Version Actuelle : 0.2.1
- ✅ Architecture modulaire stable
- ✅ Authentification OAuth (Google, Azure)
- ✅ Layout dynamique avec splits et drag & drop
- ✅ Persistance par utilisateur
- ✅ Services transverses (menus, statusbar, modals)

### Version 0.3.0 (Prochaine)
- 🔄 Révision des normes Svelte 5 (autoriser `$derived` judicieusement)
- 🔄 Documentation complète et harmonisée
- 🔄 Guide de création d'outils enrichi
- 📋 Tests unitaires pour les services core

### Version Future (0.4.0+)
- 📋 Support de thèmes personnalisés
- 📋 Marketplace d'outils communautaires
- 📋 Mode collaboration (layout partagé en temps réel)
- 📋 Internationalisation (i18n)
- 📋 Tests E2E avec Playwright
- 📋 CLI pour scaffolding de nouveaux outils

## Public Cible

### Développeurs Frontend
- **Niveau** : Intermédiaire à Avancé
- **Compétences** : Svelte 5, JavaScript moderne, concepts d'architecture
- **Besoin** : Base solide pour créer des applications complexes rapidement

### Architectes Logiciels
- **Niveau** : Senior
- **Compétences** : Patterns de conception, scalabilité, maintenabilité
- **Besoin** : Framework prouvé et extensible pour standardiser les projets

### Équipes Produit
- **Niveau** : Toute expérience
- **Compétences** : Connaissance métier, UX
- **Besoin** : Outil flexible permettant de prototyper et itérer rapidement

## Positionnement

### Ce que svelte-ide N'EST PAS
❌ Un IDE complet comme VS Code (c'est un framework pour EN créer)  
❌ Une librairie de composants UI (c'est une architecture applicative)  
❌ Un outil no-code (nécessite du développement Svelte)

### Ce que svelte-ide EST
✅ Une fondation architecturale pour applications IDE-like  
✅ Un ensemble de services et patterns éprouvés  
✅ Un accélérateur de développement pour applications complexes  
✅ Un exemple de bonnes pratiques Svelte 5

## Licence et Contribution

- **Licence** : Apache 2.0
- **Copyright** : Pierre-Yves Langlois (2024)
- **Contributions** : Projet ouvert aux pull requests et issues
- **Documentation** : Guides techniques dans `_GUIDES/`

## Références

- [ARCHITECTURE.md](./_GUIDES/ARCHITECTURE.md) - Architecture détaillée du framework
- [SVELTE5.md](./_GUIDES/SVELTE5.md) - Normes de développement Svelte 5
- [README.md](../README.md) - Guide de démarrage rapide
