# Fix : Visuels Drag & Drop Manquants dans GenericElementTree

**Date** : 11 novembre 2025  
**Composant** : `GenericElementTree.svelte` / `ElementTreeNode.svelte`  
**Issue** : Les feedbacks visuels pendant le drag & drop (interne et externe) ne s'affichaient pas

---

## 🐛 Problème Observé

Après la migration de `DocumentLibraryPanel` vers le composant abstrait `GenericElementTree`, les visuels de drag & drop étaient absents :

### ✅ Comportement Attendu (ancien composant)
1. **Drag interne** : Folder ciblé affiche un bordure bleue pointillée + fond bleu semi-transparent
2. **Drag externe** : Même visuel quand on dépose des fichiers
3. **Élément draggé** : Opacité réduite (0.6) pendant le drag

### ❌ Comportement Actuel (nouveau composant)
- Aucun feedback visuel pendant le drag
- Pas de highlight sur le folder cible
- L'élément draggé reste à opacité normale

---

## 🔍 Analyse Racine

### Structure des Composants

**GenericElementTree** (parent) :
- Définit les styles CSS
- Gère la logique de drag & drop
- Utilise `ElementTreeNode` pour le rendu

**ElementTreeNode** (enfant, récursif) :
- Applique les classes conditionnelles sur `<li class="tree-item">`
- Classes : `folder`, `drag-over`, `dragging-document`, `dragging-folder`

### Le Problème : Scoping CSS de Svelte 5

Dans l'**ancien composant** (`OLD_DocumentLibraryPanel.svelte`), tout était dans un seul fichier :
```svelte
<!-- Markup -->
<li class="tree-item" class:drag-over={...}>

<style>
  /* ✅ Fonctionne car tout est dans le même scope */
  :global(.tree-item.folder.drag-over > .tree-node::after) {
    border: 1px dashed #007acc;
  }
</style>
```

Dans le **nouveau composant**, la responsabilité est divisée :
```svelte
<!-- ElementTreeNode.svelte (composant enfant) -->
<li class="tree-item" class:drag-over={...}>

<!-- GenericElementTree.svelte (parent) -->
<style>
  /* ❌ NE FONCTIONNE PAS : .tree-item est dans un autre composant ! */
  .tree-item.folder.drag-over > .tree-node::after {
    border: 1px dashed #007acc;
  }
</style>
```

**Explication** :
- Svelte 5 scope automatiquement les styles CSS à chaque composant
- `.tree-item` sans `:global()` cherche uniquement dans `GenericElementTree.svelte`
- Mais `<li class="tree-item">` est rendu par `ElementTreeNode.svelte`
- Résultat : **le sélecteur ne matche rien**

---

## ✅ Solution

Utiliser `:global()` pour cibler les classes appliquées par les composants enfants :

### Avant (broken)
```css
/* GenericElementTree.svelte */
.tree-item.folder.drag-over > .tree-node::after {
  content: '';
  border: 1px dashed #007acc;
  background: rgba(14, 99, 156, 0.12);
}

.tree-item.folder.drag-over > .tree-node > .item-content {
  background: rgba(14, 99, 156, 0.35);
}

.tree-item.dragging-document > .tree-node > .item-content,
.tree-item.dragging-folder > .tree-node > .item-content {
  opacity: 0.6;
}
```

### Après (fixed)
```css
/* GenericElementTree.svelte */
:global(.tree-item.folder.drag-over > .tree-node::after) {
  content: '';
  border: 1px dashed #007acc;
  background: rgba(14, 99, 156, 0.12);
  pointer-events: none;
}

:global(.tree-item.folder.drag-over > .tree-node > .item-content) {
  background: rgba(14, 99, 156, 0.35);
}

:global(.tree-item.dragging-document > .tree-node > .item-content),
:global(.tree-item.dragging-folder > .tree-node > .item-content) {
  opacity: 0.6;
}
```

**Bonus** : Ajout de `:global(.tree-item)` également pour la cohérence :
```css
:global(.tree-item) {
  list-style: none;
}
```

---

## 🎨 Détails des Visuels

### 1. Drag Over un Folder
**Classe appliquée** : `.tree-item.folder.drag-over`

**Effets visuels** :
- **Pseudo-élément `::after`** :
  - Bordure pointillée bleue (`border: 1px dashed #007acc`)
  - Fond bleu semi-transparent (`background: rgba(14, 99, 156, 0.12)`)
  - Rayon de bordure 6px
  - Couvre toute la zone du node (`inset: 0`)
  
- **`.item-content`** :
  - Fond bleu plus intense (`background: rgba(14, 99, 156, 0.35)`)

### 2. Élément en Train d'Être Draggé
**Classes appliquées** :
- `.tree-item.dragging-document` (pour un fichier)
- `.tree-item.dragging-folder` (pour un dossier)

**Effet visuel** :
- Opacité réduite à 60% (`opacity: 0.6`)
- Appliqué sur `.item-content`

### 3. Drag Over la Zone Racine (SUPPRIMÉ)

**Ancien comportement** (artéfact supprimé) :
```css
/* ❌ SUPPRIMÉ - Grosse zone bleue encombrante */
.content.dragging {
  background: rgba(14, 99, 156, 0.2);
  outline: 2px dashed #007acc;
  outline-offset: -2px;
}
```

**Nouveau comportement** :
- Pas de feedback visuel sur la zone racine
- Le feedback apparaît **uniquement** sur le folder/node ciblé
- Plus propre et moins intrusif

**Note** : `rootDragActive` est conservé pour les logs de debug (`logDragState`) mais n'affecte plus le CSS.

---

## 🧪 Tests de Validation

### Test 1 : Drag Interne (Document → Folder)
1. Ouvrir le panel Document Library
2. Créer un folder "Test"
3. Drag un document sur le folder "Test"

**Résultat attendu** :
- ✅ Le folder affiche une bordure bleue pointillée
- ✅ Le fond du folder devient bleu semi-transparent
- ✅ Le document draggé est à opacité 60%

### Test 2 : Drag Externe (Fichier → Folder)
1. Ouvrir un explorateur de fichiers OS
2. Drag un fichier `.json` sur un folder
3. Observer le feedback visuel

**Résultat attendu** :
- ✅ Le folder ciblé affiche les mêmes visuels (bordure + fond)
- ✅ Pas d'opacité réduite (l'élément draggé n'est pas dans l'arbre)

### Test 3 : Drag Externe (Fichier → Zone Racine)
1. Drag un fichier sur la zone vide (pas sur un folder)
2. Observer qu'il n'y a **pas** de grosse zone bleue

**Résultat attendu** :
- ✅ **Aucune zone bleue** sur `.content` (comportement supprimé)
- ✅ Le drop fonctionne toujours (le fichier est ajouté à la racine)
- ✅ Expérience plus propre et moins intrusive

### Test 4 : Drag Folder → Folder
1. Créer deux folders "A" et "B"
2. Drag "A" sur "B"

**Résultat attendu** :
- ✅ "A" est à opacité 60% pendant le drag
- ✅ "B" affiche bordure + fond bleu
- ✅ Après drop, "A" est enfant de "B"

---

## 📚 Leçons Apprises

### 1. Scoping CSS Multi-Composants
Quand on divise un composant monolithique en composants réutilisables, les styles CSS doivent être adaptés :

| Situation | Solution |
|-----------|----------|
| Classe dans le même composant | `.my-class` (scoped) |
| Classe dans un composant enfant | `:global(.my-class)` |
| Classe partagée entre plusieurs enfants | `:global(.my-class)` |

### 2. Pattern de Composants Abstraits
Pour créer un composant abstrait réutilisable, **toujours** utiliser `:global()` pour les styles qui ciblent des éléments rendus par des composants enfants.

**Exemple** :
```svelte
<!-- Parent.svelte -->
<ChildComponent />

<style>
  /* ❌ Ne fonctionne pas */
  .child-class { color: red; }
  
  /* ✅ Fonctionne */
  :global(.child-class) { color: red; }
</style>
```

### 3. Debugging CSS Scoping
Outils pour diagnostiquer ce type de problème :

1. **Inspecteur DevTools** :
   - Vérifier si la classe est présente sur l'élément DOM
   - Vérifier si le sélecteur CSS matche
   - Chercher les sélecteurs avec des hash de scope (`[data-svelte-xxx]`)

2. **Console logs** :
   ```javascript
   logDragState('folderDragOver', { folderId: targetFolderId })
   ```
   Aide à confirmer que la logique fonctionne (état correct) mais visuels absents

3. **Comparaison Before/After** :
   - Comparer l'ancien composant monolithique
   - Identifier les sélecteurs CSS qui ciblent des éléments enfants

---

## 🔗 Fichiers Modifiés

- **`src/components/ui/generic-element-tree/GenericElementTree.svelte`**
  - Ajout de `:global()` sur 4 sélecteurs drag & drop
  - Ligne ~920-940 (styles)

---

## 📖 Références

- [Svelte 5 - CSS Scoping](https://svelte.dev/docs/svelte-components#style)
- [Pattern `:global()`](https://svelte.dev/docs/svelte-components#style-global)
- Issue originale : Feedback intégrateur document-library

---

**Status** : ✅ Résolu  
**Breaking Changes** : Aucun (fix transparent)  
**Impact** : Tous les intégrateurs de `GenericElementTree` bénéficient du fix
