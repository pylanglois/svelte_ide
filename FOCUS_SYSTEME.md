# SYSTÈME DE FOCUS GLOBAL - PLAN DÉTAILLÉ

## 🎯 OBJECTIFS

### Problèmes à Résoudre
- **Focus Incohérent** : Plusieurs éléments semblent actifs simultanément
- **Toggle Défaillant** : Les panels ne se ferment pas quand on reclique sur leur icône
- **Highlighting Incohérent** : Pas de feedback visuel uniforme pour les états
- **Persistence Manquante** : Le focus n'est pas restauré après rechargement

### Résultat Attendu
- **Focus Global Unifié** : Un seul élément peut avoir le focus à la fois dans toute l'IDE
- **Highlighting Cohérent** : États visuels uniformes (inactif/actif/focus) 
- **Toggle Fonctionnel** : Clic sur icône → toggle du panel
- **Persistence Complète** : Focus restauré après reload
- **Extensibilité Totale** : Nouveaux éléments focusables sans modifier l'IDE

## 📋 ARCHITECTURE

### Concept Central : FocusService
```javascript
class FocusService {
  // État global unique
  currentFocusId: string | null
  
  // Registry des éléments focusables
  elements: Map<string, FocusableElement>
  
  // Pour la persistence
  pendingFocusId: string | null
}
```

### Interface FocusableElement
```javascript
interface FocusableElement {
  id: string                    // ID stable et unique
  onFocusGained(): void        // Callback quand gagne le focus
  onFocusLost(): void          // Callback quand perd le focus  
  canReceiveFocus(): boolean   // Peut-il recevoir le focus ?
}
```

## 🏗️ DESIGN DES CLASSES

### 1. FocusService (Core)

**Responsabilités :**
- Maintenir l'état du focus global
- Gérer le registry des éléments focusables
- Orchestrer les transitions de focus
- Persister/restaurer l'état du focus

**API Publique :**
```javascript
class FocusService {
  // Registration
  register(element: FocusableElement): void
  unregister(id: string): void
  
  // Focus Management  
  setFocus(id: string): boolean
  clearFocus(): void
  getCurrentFocus(): FocusableElement | null
  
  // Persistence (StateProvider interface)
  saveState(): object
  restoreState(state: object): void
}
```

**Implémentation Clé :**
```javascript
setFocus(id) {
  // 1. Retirer focus actuel
  if (this.currentFocusId) {
    this.elements.get(this.currentFocusId)?.onFocusLost()
  }
  
  // 2. Donner focus au nouvel élément
  const element = this.elements.get(id)
  if (element?.canReceiveFocus()) {
    this.currentFocusId = id
    element.onFocusGained()
    return true
  }
  return false
}
```

### 2. Composants Focusables (Tab, Panel, etc.)

**Pattern d'Implémentation :**
```javascript
// Dans chaque composant focusable
let isFocused = $state(false)
const focusId = `${type}-${uniqueId}` // ID stable

$effect(() => {
  // Auto-registration
  focusService.register({
    id: focusId,
    onFocusGained: () => isFocused = true,
    onFocusLost: () => isFocused = false,
    canReceiveFocus: () => true
  })
  
  // Auto-cleanup
  return () => focusService.unregister(focusId)
})

function handleClick() {
  focusService.setFocus(focusId)
}
```

### 3. États Visuels CSS

**CSS Générique :**
```css
/* /src/styles/focus-states.css */
.focus-inactive { 
  color: #666; 
  background: #2d2d30; 
}

.focus-active { 
  color: #ccc; 
  background: #383838; 
}

.focus-focused { 
  color: #fff; 
  background: #007acc; 
  border: 1px solid #007acc; 
}
```

**Usage dans Composants :**
```svelte
<script>
  import '../styles/focus-states.css'
</script>

<div class="tab" class:focus-focused={isFocused}>
  {tab.title}
</div>
```

## 🔧 PLAN D'IMPLÉMENTATION

### Étape 1 : Créer FocusService (20 min)

**Fichier :** `/src/core/FocusService.svelte.js`

**Contenu :**
```javascript
class FocusService {
  constructor() {
    this.currentFocusId = $state(null)
    this.elements = new Map()
    this.pendingFocusId = null
  }
  
  register(element) { /* impl */ }
  unregister(id) { /* impl */ }
  setFocus(id) { /* impl */ }
  clearFocus() { /* impl */ }
  getCurrentFocus() { /* impl */ }
  saveState() { /* impl */ }
  restoreState(state) { /* impl */ }
}

export const focusService = new FocusService()
```

**Tests à faire :**
- `register()` ajoute élément au Map
- `setFocus()` appelle callbacks correctement
- `unregister()` nettoie correctement

### Étape 2 : CSS Générique (10 min)

**Fichier :** `/src/styles/focus-states.css`

**Contenu :** Les 3 classes CSS définies plus haut

**Validation :** Importer dans un composant test

### Étape 3 : Adapter Tab.svelte (15 min)

**Modifications :**
1. Importer `focusService` et CSS générique
2. Générer `focusId` stable : `tab-${tab.id}`
3. Ajouter `$effect` pour registration/cleanup
4. Ajouter `handleClick` qui appelle `setFocus`
5. Appliquer classes CSS conditionnelles

**ID Stable :** 
```javascript
const focusId = `tab-${tab.id}`
```

**Validation :** Cliquer sur tab → focus visuel correct

### Étape 4 : Adapter Toolbar.svelte (15 min)

**Modifications :**
1. Dans `activateToolInNewSystem`, remplacer logique par :
```javascript
function activateToolInNewSystem(tool) {
  const panelId = `panel-${tool.id}`
  focusService.setFocus(panelId)
}
```

**Validation :** Toggle panels fonctionne

### Étape 5 : Adapter ToolPanel.svelte (15 min)

**Modifications :**
1. Générer `focusId` : `panel-${panel.toolId}`
2. Registration au focusService
3. Toggle logic basée sur focus state

**Validation :** Panels toggle correctement

### Étape 6 : Persistence (10 min)

**Dans ideStore.svelte.js :**
```javascript
// Registration du FocusService comme StateProvider
stateProviderService.registerProvider('focus', focusService)
```

**Validation :** Focus restauré après F5

### Étape 7 : Cleanup (10 min)

**Supprimer :**
- Ancien code de focus dans `ideStore.toggleTool`
- `globalFocusedTab` dans LayoutService (si plus utilisé)
- Logique redondante dans PanelsManager

## ⚠️ PIÈGES À ÉVITER

### 1. ID Collisions
**Problème :** Deux éléments avec même ID
**Solution :** Préfixer par type : `tab-`, `panel-`, etc.

### 2. Memory Leaks
**Problème :** Oublier `unregister` dans cleanup
**Solution :** Toujours faire cleanup dans `$effect` return

### 3. Focus Race Conditions
**Problème :** Multiples `setFocus` simultanés
**Solution :** FocusService gère séquentiellement

### 4. CSS Conflicts
**Problème :** Classes CSS overridées
**Solution :** CSS générique avec `!important` si nécessaire

### 5. Persistence Timing
**Problème :** Restaurer focus avant que l'élément soit registré
**Solution :** `pendingFocusId` + check dans `register()`

## 🧪 TESTS DE VALIDATION

### Test 1 : Focus Unique
- Cliquer sur Tab1 → Tab1 focus, autres no focus
- Cliquer sur Panel1 → Panel1 focus, Tab1 perd focus

### Test 2 : Toggle Panels
- Clic icône Explorer → Panel s'ouvre + focus
- Re-clic icône Explorer → Panel se ferme + focus cleared

### Test 3 : Persistence
- Focus sur Tab "demo1.txt"
- F5 reload
- Tab "demo1.txt" a encore le focus

### Test 4 : Extensibilité
- Créer nouveau composant focusable
- Doit pouvoir recevoir focus sans modifier FocusService

## 📝 CHECKLIST FINALE

### Core
- [ ] FocusService créé et testé
- [ ] CSS générique créé
- [ ] Interface FocusableElement définie

### Composants
- [ ] Tab.svelte adapté
- [ ] Toolbar.svelte adapté  
- [ ] ToolPanel.svelte adapté
- [ ] MetadataPanel réagit au focus

### Fonctionnalités
- [ ] Focus unique à travers l'IDE
- [ ] Toggle panels fonctionne
- [ ] Highlighting cohérent
- [ ] Persistence après reload

### Cleanup
- [ ] Ancien code focus supprimé
- [ ] Pas de memory leaks
- [ ] Pas de conflits CSS

## 🚀 ORDRE D'EXÉCUTION

1. **FocusService + CSS** (30 min)
2. **Tab.svelte** (15 min) 
3. **Toolbar.svelte** (15 min)
4. **ToolPanel.svelte** (15 min)
5. **Persistence** (10 min)
6. **Cleanup + Tests** (15 min)

**Total : ~100 minutes**

## 📖 RÉFÉRENCE RAPIDE

### Pattern Composant Focusable
```javascript
import { focusService } from '@/core/FocusService.svelte.js'
import '../styles/focus-states.css'

let isFocused = $state(false)
const focusId = `montype-${monObjet.id}`

$effect(() => {
  focusService.register({
    id: focusId,
    onFocusGained: () => isFocused = true,
    onFocusLost: () => isFocused = false,
    canReceiveFocus: () => true
  })
  return () => focusService.unregister(focusId)
})

<div class:focus-focused={isFocused} onclick={() => focusService.setFocus(focusId)}>
```

### Pattern CSS
```css
@import '../styles/focus-states.css';
.mon-composant.focus-focused { /* customisation si nécessaire */ }
```

## 🧹 MIGRATION ET NETTOYAGE DES ANCIENS SYSTÈMES

### Vue d'Ensemble du Code Legacy

L'analyse du code existant révèle **3 systèmes de focus différents** qui coexistent actuellement :

1. **Système LayoutService** : `globalFocusedTab` pour les tabs
2. **Système ideStore** : `focusedPanel` + `activeToolsByPosition` pour les tools
3. **Système PanelsManager** : `isActive` pour les panels

Cette fragmentation cause les problèmes identifiés. Le nouveau FocusService doit remplacer TOUS ces systèmes.

### 🎯 Code Legacy à Nettoyer

#### **1. LayoutService.svelte.js - Système globalFocusedTab**

**Code à Supprimer :**
```javascript
// Constructor
this.globalFocusedTab = $state(null)

// Toutes les références à globalFocusedTab (25+ occurrences)
this.globalFocusedTab = tabId
if (this.globalFocusedTab === tabId)
serializableLayout.globalFocusedTab = this.globalFocusedTab

// Méthodes complètes à supprimer
setGlobalFocus(tabId)
restoreGlobalFocus(tabId) 
clearGlobalFocus()

// Dans activeTab getter
if (this.globalFocusedTab) {
  return this.getTabById(this.globalFocusedTab)
}
```

**Impact :** Le `activeTab` getter devra utiliser FocusService au lieu de globalFocusedTab

#### **2. ideStore.svelte.js - Système Tools/Panels**

**Code à Supprimer Complètement :**
```javascript
// État obsolète
this.focusedPanel = $state(null)
this.activeToolsByPosition = $state({...})

// Méthodes complètes à supprimer  
toggleTool(toolId)              // ~20 lignes
setFocusedPanel(panelType)      // ~4 lignes
clearFocusedPanel()             // ~4 lignes

// Dans saveState/restoreState
activeToolsByPosition: { ...this.activeToolsByPosition }
Object.assign(this.activeToolsByPosition, state.activeToolsByPosition)
```

**Impact :** Toolbar.svelte ne pourra plus appeler `ideStore.toggleTool()`

#### **3. Tool.svelte.js - Méthodes activate/deactivate**

**Code à Analyser :**
```javascript
// Ces méthodes sont-elles encore utilisées ?
activate() {
  this.active = true
  // logique d'activation
}

deactivate() {
  this.active = false  
  // logique de désactivation
}
```

**Statut :** À vérifier si utilisées ailleurs que dans `toggleTool()`

#### **4. PanelsManager.svelte.js - Double Système**

**Code Redondant à Simplifier :**
```javascript
// Système isActive redondant avec le focus
panel.isActive = true/false

// Méthodes qui font double emploi
activatePanel() / deactivatePanel()
togglePanel()
```

**Strategy :** Garder `togglePanel()` mais simplifier la logique

#### **5. Composants avec Ancien Focus**

**Console.svelte :**
```javascript
// À supprimer
onfocus={() => ideStore.setFocusedPanel('console')}
onblur={() => ideStore.clearFocusedPanel()}
onclick={() => ideStore.setFocusedPanel('console')}
```

**MetadataPanel.svelte :**
```javascript
// À remplacer par FocusService
const currentActiveTab = layoutService.activeTab
let activeTabId = $state(null)
```

### 🔍 Stratégies de Détection du Code Mort

#### **1. Grep Patterns de Détection**
```bash
# Rechercher les anciennes APIs
grep -r "toggleTool\|setFocusedPanel\|clearFocusedPanel" src/
grep -r "globalFocusedTab\|activeToolsByPosition" src/
grep -r "\.activate()\|\.deactivate()" src/
grep -r "activatePanel\|deactivatePanel" src/
```

#### **2. Points de Surveillance**
- **ideStore.toggleTool()** : Utilisé dans Toolbar → À remplacer
- **layoutService.globalFocusedTab** : Utilisé dans TabBar → À remplacer  
- **ideStore.focusedPanel** : Utilisé pour highlighting → À remplacer
- **tool.activate/deactivate** : Vérifier les usages réels

### 📝 Plan de Nettoyage Progressif

#### **Phase 1 : Remplacement sans Suppression (Parallèle)**
- Implémenter FocusService 
- Adapter composants au FocusService
- **Garder** ancien code temporairement
- Tester que nouveau système fonctionne

#### **Phase 2 : Migration Progressive** 
```javascript
// Approche : Dual-mode temporaire
function setFocus(elementId) {
  // Nouveau système
  focusService.setFocus(elementId)
  
  // Ancien système (temporaire pour compatibility)
  if (elementId.startsWith('tab-')) {
    layoutService.globalFocusedTab = elementId.replace('tab-', '')
  }
}
```

#### **Phase 3 : Nettoyage Agressif**
1. **Supprimer méthodes obsolètes**
2. **Nettoyer états inutilisés** 
3. **Simplifier logique redondante**
4. **Valider aucune régression**

### ⚠️ Pièges de Migration Spécifiques

#### **1. Dépendances Cachées**
```javascript
// ATTENTION: Code qui peut paraître inutilisé mais ne l'est pas
get activeTab() {
  // Peut être utilisé dans d'autres tools non découverts
  return this.globalFocusedTab ? ... : ...
}
```

**Solution :** Grep complet avant suppression

#### **2. Persistence Compatibility**
```javascript
// ATTENTION: Anciens layouts sauvés contiennent globalFocusedTab
layoutData.layout.globalFocusedTab = "tab-123"
```

**Solution :** Migration des données de persistence

#### **3. Event Handlers Orphelins**
```javascript
// ATTENTION: Events qui appellent ancien système
onclick={() => ideStore.toggleTool(toolId)}
```

**Solution :** Recherche systématique des event handlers

### 🧪 Tests de Régression Critiques

#### **Test 1 : Aucun Appel Ancien Système**
```javascript
// Ajouter console.warn dans anciennes méthodes
toggleTool(toolId) {
  console.warn('LEGACY: toggleTool() appelé - migration incomplète')
  // logique existante
}
```

#### **Test 2 : État Cohérent**
- Vérifier qu'aucun élément n'utilise ancien highlighting
- Confirmer que focus global fonctionne
- Tester persistence avec ancien et nouveau format

#### **Test 3 : Performance**
- S'assurer qu'aucun ancien listener ne reste actif
- Vérifier memory leaks des anciens systèmes

### 📋 Checklist de Nettoyage Final

#### **Code à Supprimer Définitivement**
- [ ] `ideStore.toggleTool()` - Méthode complète
- [ ] `ideStore.focusedPanel` - Propriété $state
- [ ] `ideStore.activeToolsByPosition` - Propriété $state
- [ ] `ideStore.setFocusedPanel()` - Méthode complète
- [ ] `ideStore.clearFocusedPanel()` - Méthode complète
- [ ] `layoutService.globalFocusedTab` - Propriété $state
- [ ] `layoutService.setGlobalFocus()` - Méthode complète
- [ ] `layoutService.restoreGlobalFocus()` - Méthode complète
- [ ] `layoutService.clearGlobalFocus()` - Méthode complète

#### **Code à Adapter**
- [ ] `layoutService.activeTab` getter - Utiliser FocusService
- [ ] `TabBar.svelte` - Focus basé sur FocusService
- [ ] `Toolbar.svelte` - Remplacer `activateToolInNewSystem`
- [ ] `Console.svelte` - Events focus vers FocusService
- [ ] `MetadataPanel.svelte` - React au FocusService

#### **Validation Finale**
- [ ] Aucun `console.warn` dans les logs
- [ ] Performance équivalente ou meilleure
- [ ] Tests de régression passent
- [ ] Persistence fonctionne avec nouveaux et anciens layouts

### 🎯 Ordre de Nettoyage Recommandé

1. **Étape 1-6** : Implémentation complète du nouveau système
2. **Tests complets** : Valider que nouveau système fonctionne à 100%
3. **Nettoyage progressif** : Supprimer un ancien système à la fois
4. **Tests de régression** : Après chaque suppression
5. **Nettoyage final** : Code mort et optimisations
