# GenericElementTree – Sélection multiple & navigation clavier

**Date** : 14 novembre 2025  
**Auteur** : Codex (assistant)  
**Contexte** : Suite à la demande d'aligner l’explorateur générique sur les interactions standard des IDE (cf. _GUIDES/PRODUCT.md et _GUIDES/ARCHITECTURE.md), il faut clarifier les besoins et l’état actuel avant d’engager le chantier.

---

## ✅ Besoins
- **Sélection multiple souris** : répliquer les comportements de l’explorer VS Code (Ctrl/Cmd + clic pour ajouter/retirer un élément, Shift + clic pour créer un intervalle contigu basé sur l’ancre active).
- **Navigation clavier** : permettre le déplacement du focus avec ↑/↓, l’extension de sélection avec Shift + flèches, l’ouverture/fermeture des dossiers avec ←/→, et Enter/Espace pour activer l’élément courant.
- **Source de vérité unique** : exposer un état `selectedNodeIds` (ou équivalent) piloté par le composant parent, afin de garder le contrôle du store métier conformément aux principes de _GUIDES/ARCHITECTURE.md.
- **Accessibilité & styles** : refléter la sélection/focus via `aria-selected`, `aria-activedescendant`, classes CSS et tokens couleurs cohérents avec la charte VS Code-like décrite dans _GUIDES/PRODUCT.md.
- **Drag & drop groupé** : le glisser-déposer doit embarquer l’ensemble des éléments sélectionnés ; l’opération doit être atomique (validation des ancêtres/filtres appliqués à toute la sélection) et notifier `onTreeChange` une seule fois.
- **API/événements** : fournir des callbacks explicites (`onSelectionChange`, `onMultiOpen`, etc.) documentés dans _GUIDES/SVELTE5.md afin que les consommateurs sachent gérer les modifications.

---

## 🔍 Constats actuels
- **Pas d’état de sélection** : `handlePrimaryAction` (`GenericElementTree.svelte:396`) déclenche immédiatement `onNodeSelect/onNodeOpen` pour un seul nœud sans stocker d’état, rendant impossible tout comportement avancé.
- **Interactions limitées** : `ElementTreeNode.svelte` écoute seulement le clic simple et Enter (`lines 64-99`), aucune gestion des touches Ctrl/Shift ni des flèches directionnelles, ce qui va à l’encontre des attentes IDE.
- **ARIA incomplète** : `aria-selected="false"` est codé en dur (`ElementTreeNode.svelte:55`), empêchant les technologies d’assistance de connaître l’élément actif ou sélectionné.
- **Drag & drop mono-élément** : toute la chaîne (vars `draggedNodeId/Type`, handlers `handleFolderDrop`, `moveNode`) est bâtie autour d’un seul identifiant, donc impossible de déplacer un lot sans réécrire la logique.
- **Impact API** : les props/events publics ne prévoient pas de sélection multiple ; il faudra introduire de nouvelles signatures ou majorer la version pour ne pas casser les intégrations existantes.
- **Dette technique** : l’ordre linéaire des nœuds visibles n’est pas matérialisé (pas de flatten cache), ce qui complique le calcul de plages Shift et la navigation aux flèches tant que cette structure n’existe pas.

---

## 📎 Notes complémentaires
- Ce chantier s’inscrit dans les évolutions prévues par `_TODOS/generic-tree-folder-import-plan.md`, car la sélection multiple influencera aussi l’import hiérarchique (confirmation, drag external).
- Prévoir des tests d’interaction (Playwright ou Vitest DOM) couvrant les combinaisons clavier/souris pour éviter les régressions lors des optimisations futures.
