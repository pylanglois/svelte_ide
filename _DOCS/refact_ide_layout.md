# Plan de Refactorisation du Layout IDE

Ce document détaille le plan complet de refactorisation de l'architecture layout de l'IDE Svelte pour créer un système générique, extensible et performant.

## 🎯 Vision et Objectifs

### Problèmes Actuels
- **ideStore.svelte.js** : 450+ lignes, responsabilités mélangées
- **LayoutService.svelte.js** : 548 lignes, focus limité aux tabs/splits
- **Structure codée en dur** : `topLeft`, `bottomLeft`, etc.
- **Drag & Drop fragmenté** : 2 systèmes séparés (outils vs tabs)
- **Persistence ad-hoc** : Sauvegarde codée en dur dans ideStore
- **Pas d'extensibilité** : Impossible pour les outils d'ajouter leurs zones

### Vision Target
- **Système générique** : N'importe quel composant peut s'enregistrer comme zone
- **Persistence universelle** : Système ouvert pour tous les outils
- **Drag & Drop unifié** : Un seul système pour tous les types
- **Architecture modulaire** : Fichiers < 150 lignes avec responsabilités claires
- **Extensibilité complète** : Outils peuvent ajouter zones, persistence, drop zones

## 📋 Plan de Réalisation (6 Phases)

### Phase 1 : Fondations - Registres Centraux

#### 1.1 ZoneRegistry.svelte.js
**Rôle** : Registre dynamique de toutes les zones de l'IDE
**Responsabilités** :
- Enregistrement/désenregistrement de zones
- Métadonnées de zones (type, position, resizable, persistable)
- API de recherche et filtrage

```javascript
src/core/layout/ZoneRegistry.svelte.js (120 lignes)
├── constructor()
├── registerZone(id, config)
├── unregisterZone(id)
├── getZone(id)
├── getZonesByType(type)
├── getZonesByPosition(position)
└── getAllZones()
```

#### 1.2 PersistenceRegistry.svelte.js
**Rôle** : Système de persistence générique par namespace
**Responsabilités** :
- Enregistrement de persisters par namespace
- Sauvegarde/restauration avec priorités
- Gestion des erreurs et fallbacks

```javascript
src/core/persistence/PersistenceRegistry.svelte.js (150 lignes)
├── constructor()
├── registerPersister(namespace, persister, priority)
├── unregisterPersister(namespace)
├── saveAll(user)
├── restoreAll(user)
├── saveNamespace(namespace)
└── restoreNamespace(namespace, data)
```

#### 1.3 PersisterInterface.js
**Rôle** : Interface contractuelle pour les persisters
**Responsabilités** :
- Définir le contrat export/import
- Types et validation de base

```javascript
src/core/persistence/PersisterInterface.js (50 lignes)
├── export() // async
├── import(data) // async
├── getNamespace()
├── getDefaults()
└── validate(data)
```

### Phase 2 : Services Layout Génériques

#### 2.1 GenericLayoutService.svelte.js
**Rôle** : Gestion générique de l'état des zones
**Responsabilités** :
- État réactif par zone (taille, visibilité, contenu)
- API générique sans connaissance de structure
- Focus et état global

```javascript
src/core/layout/GenericLayoutService.svelte.js (130 lignes)
├── constructor(zoneRegistry)
├── setZoneProperty(zoneId, property, value)
├── getZoneProperty(zoneId, property, defaultValue)
├── setZoneVisibility(zoneId, visible)
├── setZoneSize(zoneId, size)
├── setActiveZone(zoneId)
├── getActiveZone()
└── getAllZoneStates()
```

#### 2.2 TabsManager.svelte.js
**Rôle** : Gestion spécialisée des tabs (extrait de LayoutService)
**Responsabilités** :
- Logique tabs/splits uniquement
- Intégration avec le système générique

```javascript
src/core/layout/TabsManager.svelte.js (100 lignes)
├── constructor(genericLayoutService)
├── addTab(tab)
├── closeTab(tabId)
├── setActiveTab(tabId)
├── moveTabBetweenGroups()
├── createSplit()
└── exportTabsState()
```

#### 2.3 PanelsManager.svelte.js
**Rôle** : Gestion des panneaux d'outils
**Responsabilités** :
- Activation/désactivation des outils
- Redimensionnement des panneaux
- État des panneaux

```javascript
src/core/layout/PanelsManager.svelte.js (80 lignes)
├── constructor(genericLayoutService)
├── setActiveToolInPanel(panelId, toolId)
├── setPanelSize(panelId, size)
├── setPanelVisibility(panelId, visible)
└── exportPanelsState()
```

### Phase 3 : Système Drag & Drop Unifié

#### 3.1 DragDropTypes.js
**Rôle** : Constantes et types pour le drag & drop
**Responsabilités** :
- Définition des types de drag (tab, tool, file, custom)
- Zones de drop (panel, split-zone, custom)

```javascript
src/core/dragdrop/DragDropTypes.js (40 lignes)
├── DRAG_TYPES
├── DROP_ZONES
├── VALIDATION_RULES
└── DEFAULT_CONFIGS
```

#### 3.2 UnifiedDragDropService.svelte.js
**Rôle** : Service unifié pour tous les types de drag & drop
**Responsabilités** :
- Gestion état de drag global
- Validation des drops
- Exécution des drops

```javascript
src/core/dragdrop/UnifiedDragDropService.svelte.js (120 lignes)
├── constructor()
├── startDrag(type, item, source)
├── setDropPreview(zone, rect)
├── isValidDrop(zone, target)
├── executeDrop(zone, target)
├── endDrag()
└── getDragInfo()
```

#### 3.3 DropZoneRegistry.svelte.js
**Rôle** : Registre des zones de drop dynamiques
**Responsabilités** :
- Enregistrement de drop zones par composants
- Validation des drops selon types acceptés
- Zones actives selon drag en cours

```javascript
src/core/dragdrop/DropZoneRegistry.svelte.js (100 lignes)
├── constructor()
├── registerDropZone(id, config)
├── unregisterDropZone(id)
├── updateActiveZones(draggedItem)
├── isValidDrop(zone, draggedItem)
└── getActiveDropZones()
```

### Phase 4 : Composants Génériques

#### 4.1 GenericDropZone.svelte
**Rôle** : Composant drop zone réutilisable
**Responsabilités** :
- Auto-enregistrement dans DropZoneRegistry
- Gestion visuelle des états (active, hovered)
- Events de drop configurables

```svelte
src/core/layout/GenericDropZone.svelte (80 lignes)
├── props: id, acceptedTypes, validator, onDrop
├── auto-register/unregister
├── visual states management
└── drop event handling
```

#### 4.2 ZoneContainer.svelte
**Rôle** : Container générique pour les zones
**Responsabilités** :
- Lecture de l'état depuis GenericLayoutService
- Gestion redimensionnement
- Persistence automatique

```svelte
src/core/layout/ZoneContainer.svelte (60 lignes)
├── props: zoneId, resizable
├── read zone state
├── handle resize
└── auto-persistence
```

#### 4.3 PersistableComponent.svelte
**Rôle** : Mixin/Base pour composants persistables
**Responsabilités** :
- Auto-enregistrement persistence
- Écoute événements restauration
- Template de base

```svelte
src/core/persistence/PersistableComponent.svelte (70 lignes)
├── props: namespace, persister
├── auto-register persistence
├── listen restore events
└── lifecycle management
```

### Phase 5 : Refactorisation des Composants Existants

#### 5.1 MainViewSplit.svelte (Nouveau)
**Migration** : Utilise le système générique
**Changements** :
- S'enregistre comme zone 'main-view'
- Utilise TabsManager au lieu de LayoutService direct
- Persistence via PersistenceRegistry

#### 5.2 ToolPanel.svelte (Refactorisé)
**Migration** : Utilise PanelsManager
**Changements** :
- Lecture état via GenericLayoutService
- Drop zones via GenericDropZone
- Persistence automatique

#### 5.3 Toolbar.svelte (Refactorisé)
**Migration** : Utilise UnifiedDragDropService
**Changements** :
- Drag & drop unifié
- Zones d'enregistrement dynamiques
- Plus de logique codée en dur

### Phase 6 : Store Simplifié et API Publique

#### 6.1 CoreStore.svelte.js
**Rôle** : Store central sans logique layout
**Responsabilités** :
- Gestion outils, notifications, console
- Pas de couplage layout

```javascript
src/stores/CoreStore.svelte.js (200 lignes)
├── tools management
├── notifications management
├── console management
├── user/auth integration
└── clean API
```

#### 6.2 IDEFacade.svelte.js
**Rôle** : API publique qui coordonne tous les services
**Responsabilités** :
- Facade pattern vers tous les services
- API backward-compatible
- Coordination entre services

```javascript
src/stores/IDEFacade.svelte.js (100 lignes)
├── constructor() // init all services
├── addTab(tab) // delegates to TabsManager
├── toggleTool(toolId) // coordinates core + panels
└── addDropZone(config) // delegates to DropZoneRegistry
```

## 🔄 Stratégie de Migration

### Phase Migration A : Système Parallèle (0 Breaking Changes)
1. **Créer les nouveaux services** en parallèle
2. **LegacyAdapter** pour mapper ancien → nouveau
3. **Feature flag** pour activer progressivement
4. **Tests de compatibilité** sur l'API existante

### Phase Migration B : Migration Progressive
1. **MainViewSplit** → premier composant migré
2. **Un panneau d'outil** → validation du système
3. **Drag & drop unifié** → remplacement progressif
4. **Persistence** → migration des données existantes

### Phase Migration C : Remplacement Complet
1. **Suppression ancien LayoutService**
2. **Suppression ideStore legacy**
3. **Nettoyage des composants**
4. **Documentation finale**

## 📂 Structure de Fichiers Finale

```
src/core/
├── layout/
│   ├── ZoneRegistry.svelte.js         (120 lignes)
│   ├── GenericLayoutService.svelte.js (130 lignes)
│   ├── TabsManager.svelte.js          (100 lignes)
│   ├── PanelsManager.svelte.js        (80 lignes)
│   ├── GenericDropZone.svelte         (80 lignes)
│   ├── ZoneContainer.svelte           (60 lignes)
│   └── index.js                       (exports)
├── persistence/
│   ├── PersistenceRegistry.svelte.js  (150 lignes)
│   ├── PersisterInterface.js          (50 lignes)
│   ├── PersistableComponent.svelte    (70 lignes)
│   └── index.js                       (exports)
├── dragdrop/
│   ├── DragDropTypes.js               (40 lignes)
│   ├── UnifiedDragDropService.svelte.js (120 lignes)
│   ├── DropZoneRegistry.svelte.js     (100 lignes)
│   └── index.js                       (exports)

src/stores/
├── CoreStore.svelte.js                (200 lignes)
├── IDEFacade.svelte.js                (100 lignes)
├── authStore.svelte.js                (inchangé)
└── index.js                           (exports)

src/components/layout/
├── containers/
│   ├── MainViewSplit.svelte           (refactorisé, 80 lignes)
│   ├── PanelContainer.svelte          (nouveau, 60 lignes)
│   └── LayoutContainer.svelte         (nouveau, 80 lignes)
├── chrome/
│   ├── Toolbar.svelte                 (refactorisé, 80 lignes)
│   ├── ToolPanel.svelte               (refactorisé, 60 lignes)
│   ├── StatusBar.svelte               (inchangé)
│   └── TitleBar.svelte                (inchangé)
└── navigation/
    ├── TabBar.svelte                  (refactorisé)
    ├── Tab.svelte                     (légèrement modifié)
    └── DropZones.svelte               (remplacé par GenericDropZone)
```

## 🎯 Bénéfices Attendus

### ✅ Extensibilité
- N'importe quel outil peut ajouter ses zones
- Persistence ouverte à tous
- Drop zones configurables par composant

### ✅ Maintenabilité
- Fichiers < 150 lignes
- Responsabilités claires et séparées
- Tests unitaires possibles

### ✅ Performance
- Enregistrements O(1)
- Système de priorités pour la restauration
- Validation avec fallbacks

### ✅ Compatibilité
- Migration progressive sans breaking changes
- API publique préservée
- Adaptateur de compatibilité

## 🚀 Prochaines Étapes

1. **Valider ce plan** avec l'équipe
2. **Commencer Phase 1** : ZoneRegistry + PersistenceRegistry
3. **Créer l'adaptateur** de compatibilité
4. **Migrer MainViewSplit** comme proof-of-concept
5. **Étendre progressivement** aux autres composants

## 📝 Notes d'Implémentation

### Règles Svelte 5
- ✅ Pas de `$derived` → `$effect` + `$state` uniquement
- ✅ Imports absolus via `@/` uniquement
- ✅ Séparation IDE/Outils stricte respectée
- ✅ API via facades et services

### Performance
- Registres utilisant `Map` pour O(1)
- Enregistrements lazy quand possible
- Validation avec schemas simples
- Persistence par batch avec priorités

### Tests
- Services purs → tests unitaires faciles
- Registres → tests d'intégration
- Composants → tests de comportement
- Migration → tests de régression
