# Changelog

Toutes les modifications notables du projet seront documentées dans ce fichier.

Le format est basé sur [Keep a Changelog](https://keepachangelog.com/fr/1.0.0/),
et ce projet adhère au [Versionnage Sémantique](https://semver.org/lang/fr/).

## [Non publié]

### 🐛 Corrigé

#### GenericElementTree : Visuels Drag & Drop Manquants
- **Problème** : Les feedbacks visuels pendant le drag & drop (bordure bleue pointillée, fond bleu, opacité réduite) ne s'affichaient pas
- **Cause** : Scoping CSS de Svelte 5 - les styles dans `GenericElementTree` ne ciblaient pas les classes appliquées par `ElementTreeNode`
- **Fix** : Ajout de `:global()` sur les sélecteurs `.tree-item.drag-over`, `.tree-item.dragging-document`, `.tree-item.dragging-folder`
- **Bonus** : Suppression de la grosse zone bleue sur `.content.dragging` (artéfact de l'ancien code, remplacé par feedback ciblé sur les folders)
- **Impact** : Les visuels de drag & drop fonctionnent maintenant comme dans l'ancien composant monolithique, mais plus propres
- **Documentation** : `_DOCS/GENERIC_ELEMENT_TREE_DRAG_VISUAL_FIX.md`

#### Race Condition IndexedDB au Démarrage
- **Problème** : Erreur `DOMException: IDBDatabase.transaction: Can't start a transaction on a closed database` au clic sur un tool après le démarrage
- **Cause** : Double bug identifié par un intégrateur
  1. `ideStore.saveUserLayout()` appelé sans vérifier si IndexedDB était prête
  2. `App.svelte` publiait `persistence:ready` **avant** que `readyForEncryption()` soit résolu
- **Fix** :
  - `ideStore.svelte.js` : Ajout d'un flag `_persistenceReady` avec garde dans `saveUserLayout()`
  - `App.svelte` : Attente de `await indexedDBService.readyForEncryption()` avant de publier l'événement
- **Impact** : Console propre au démarrage, pas de retry inutile, sauvegarde garantie quand la DB est opérationnelle
- **Documentation** : `_DOCS/IDXDB_RACE_CONDITION_COMPLETE_FIX.md`

### 🎉 Ajouté

#### Cache d'Avatars Utilisateurs
- **AvatarCacheService** : Nouveau service de cache IndexedDB pour photos de profil
  - Persistance locale des avatars (TTL 24h)
  - Restauration instantanée après reload/refresh token
  - Économie de bande passante (~15-50 KB par session)
  - Nettoyage automatique au logout et expiration
- **Intégration providers** : AzureProvider et GoogleProvider utilisent le cache automatiquement
  - Téléchargement uniquement si cache MISS ou expiré
  - Fallback gracieux si IndexedDB indisponible

### 🐛 Corrigé

#### Authentification Azure et Google
- **AzureProvider** : Ajout du champ `sub` (subject) dans `userInfo` pour compatibilité OAuth2/OIDC
  - Azure retournait uniquement `id`, causant l'erreur "userInfo.sub is required for key derivation"
  - Normalisation : `sub: userData.id` + conservation de `id` pour compatibilité descendante
- **GoogleProvider** : Même normalisation pour cohérence
  - Google retourne `sub` natif mais mapping explicite ajouté pour garantir la présence
  - Format uniforme entre tous les providers
- **Impact** : La dérivation de clé de chiffrement (`EncryptionKeyDerivation`) fonctionne maintenant avec Azure

#### API Publique
- **Exports** : Ajout de `getAuthStore` dans `public-api.js`
  - Permet aux applications clientes d'accéder au store d'authentification
  - Usage : `const authStore = getAuthStore(); const token = authStore.getAccessToken()`

## [0.3.0] - 2025-01-05

### 🎯 Révision Majeure de la Documentation et des Normes Svelte 5

Cette version représente une révision complète de la documentation du projet et une correction importante des normes Svelte 5 basée sur une analyse historique approfondie des incidents passés.

### 📚 Ajouté

#### Documentation Produit
- **PRODUCT.md** : Nouveau document exhaustif (200+ lignes) décrivant :
  - Vision et objectifs business du framework svelte-ide
  - 4 cas d'usage cibles détaillés (gestion de données, IDE métier, dashboards, outils internes)
  - Fonctionnalités phares du cœur et de l'extensibilité
  - Principes de conception (KISS, convention sur configuration)
  - Roadmap avec versions 0.3.0, 0.4.0+
  - Public cible et positionnement
  
#### Documentation Technique
- **SVELTE5.md** : Enrichissement massif
  - Section 3 : Anti-patterns `$effect` avec 3 patterns dangereux documentés
  - Section 4 : Guide complet de debugging (`$inspect()`, `$state.snapshot()`)
  - Section 6 : Exemples concrets de migrations du projet
  - Tableau récapitulatif des patterns utilisés par composant
  
- **ARCHITECTURE.md** :
  - Mentions ajustées de `$derived` pour refléter les nouvelles normes
  - Clarifications sur l'utilisation judicieuse des runes
  
- **README.md** :
  - Lien vers PRODUCT.md dans la section Philosophie
  - Résumé des normes Svelte 5 actualisées
  
- **CHANGELOG.md** : Ce fichier pour tracer les évolutions futures

### ♻️ Modifié

#### Normes Svelte 5
- **Révision de la politique `$derived`** :
  - **AVANT** : Interdiction totale de `$derived` (norme considérée trop restrictive)
  - **APRÈS** : Usage judicieux autorisé pour les dépendances directes simples
  - **Justification** : Analyse historique (.specstory/history/) révélant que :
    - 1 seul incident lié à `$derived` (TabScrollContainer 2025-08-01)
    - 5+ incidents liés à `$effect` avec boucles infinies
    - Interdiction de `$derived` était une sur-réaction
    
- **Matrice de décision `$derived` vs `$effect`** :
  - Dépendances directes (props) → `$derived` recommandé
  - Dépendances indirectes (services, stores) → `$effect` + `$state` requis
  - Objets complexes ou side-effects → `$effect` + `$state` requis

#### Migrations de Code Sélectives
- **StatusBar.svelte** :
  - Migration : `$derived(statusBarService.sections)` → `$effect` + `$state`
  - Raison : Service externe (dépendance indirecte)
  - Ajout : `$inspect()` conditionné au mode DEV
  
- **TitleBar.svelte** :
  - Migration : Props `branding` → `$effect` + `$state` séparés
  - Raison : Objet complexe avec composant + props
  - Ajout : `$inspect()` pour debugging
  
- **App.svelte** :
  - Migration : `resolvedBranding` → `$effect` + `$state`
  - Raison : Normalisation de props avec fonction helper
  - Ajout : `$inspect()` pour debugging

### ✅ Conservé Conforme

#### Composants avec `$derived` Valide
Les composants suivants **conservent `$derived`** car conformes aux nouvelles normes (props simples + fallbacks) :
- `ActiveTabItem.svelte` : 3 `$derived` (icon, label, title avec fallbacks)
- `ClockItem.svelte` : 3 `$derived` (locale, options, className avec fallbacks)
- `StatusMessageItem.svelte` : 2 `$derived` (fallback, className avec fallbacks)

**Total : 8 occurrences `$derived` conformes sur 9 totales** (9ème = commentaire)

### 🐛 Corrigé

- **Warnings console** : Élimination des warnings "console.log contained $state proxies" en utilisant `$inspect()` natif
- **Cohérence documentation/code** : Alignement complet entre normes SVELTE5.md et implémentation réelle
- **Debugging** : Remplacement des `console.log` par `$inspect()` conditionné au mode DEV

### 🔍 Validation

#### Revue de Code
- ✅ Scan complet : 9 occurrences `$derived` (8 conformes + 1 commentaire)
- ✅ Scan `$effect` : 42+ occurrences vérifiées, aucune boucle infinie détectée
- ✅ Tous les `$inspect()` correctement conditionnés (`import.meta.env.DEV`)
- ✅ Aucune erreur de compilation dans les fichiers migrés

#### Tests Fonctionnels
- ✅ StatusBar : Affichage dynamique des sections (left/center/right)
- ✅ TitleBar : Rendu du branding avec composants personnalisés
- ✅ App : Normalisation des props `branding` et `externalTools`
- ✅ Debugging : `$inspect()` actif uniquement en mode développement

### 📊 Statistiques

- **Documentation** :
  - PRODUCT.md : 0 → 200+ lignes (création complète)
  - SVELTE5.md : +150 lignes (sections 3, 4, 6)
  - ARCHITECTURE.md : ~20 lignes modifiées
  - README.md : +15 lignes
  
- **Code** :
  - 3 fichiers migrés (`$derived` → `$effect` + `$state`)
  - 3 fichiers conservés avec `$derived` conforme
  - 0 erreur de compilation introduite
  - 6 `$inspect()` ajoutés (tous conditionnés DEV)

### 🔗 Références

- [PRODUCT.md](./_GUIDES/PRODUCT.md) - Vision et objectifs du produit
- [ARCHITECTURE.md](./_GUIDES/ARCHITECTURE.md) - Architecture technique détaillée
- [SVELTE5.md](./_GUIDES/SVELTE5.md) - Normes de développement Svelte 5
- [Plan de conformité](./_GUIDES/feature_plan/2025-11-05_conformite-svelte5.md) - Plan d'exécution complet

---

## [0.2.1] - 2024-12-XX

Version antérieure avec architecture modulaire stable, authentification OAuth, et layout dynamique.

### Fonctionnalités Principales
- ✅ Architecture modulaire core/tools
- ✅ Authentification OAuth (Google, Azure)
- ✅ Layout dynamique avec splits et drag & drop
- ✅ Persistance par utilisateur
- ✅ Services transverses (menus, statusbar, modals)

---

## Format de Versionnage

- **MAJOR** (X.0.0) : Changements incompatibles de l'API publique
- **MINOR** (0.X.0) : Ajout de fonctionnalités rétrocompatibles
- **PATCH** (0.0.X) : Corrections de bugs rétrocompatibles
