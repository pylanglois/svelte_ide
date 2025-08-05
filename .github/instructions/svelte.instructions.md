---
applyTo: '**'
---
# Instructions Principales pour l'IA

Ce document contient les règles fondamentales et non négociables pour ce projet.

## 1. La Règle d'Or : La Séparation des Responsabilités

**LA SÉPARATION STRICTE ENTRE LE CŒUR DE L'IDE (`src/core`, `src/stores`, `src/components/layout`) ET LES OUTILS (`src/tools`) EST LA RÈGLE LA PLUS IMPORTANTE DE CE PROJET.**

-   L'IDE ne doit **jamais** dépendre d'un outil spécifique.
-   Les outils ne doivent interagir avec l'IDE **que** via les services exposés (principalement via `ideStore`).

## 2. RÈGLE CRITIQUE : INTERDICTION DE $DERIVED

**IMPORTANT : Cette règle a été ajoutée après plusieurs incidents répétés.**

### ⚠️ INTERDICTION STRICTE DE `$derived` ⚠️

- **JAMAIS** utiliser `$derived` dans ce projet
- **TOUJOURS** utiliser `$effect` + `$state` pour les valeurs calculées
- **MÊME** pour des calculs qui semblent "purs" mathématiquement

### Pourquoi cette interdiction ?

Le piège `$derived` s'est répété plusieurs fois dans ce projet, causant des pertes de temps importantes. Les calculs complexes avec plusieurs variables réactives (comme les dimensions de scrollbar) créent des dépendances indirectes que Svelte ne détecte pas correctement.

### Pattern Obligatoire

```javascript
// ❌ INTERDIT - Même pour des calculs "simples"
let result = $derived(a * b + c)

// ✅ OBLIGATOIRE - Pattern $effect + $state
let result = $state(0)
$effect(() => {
  result = a * b + c
  console.log('result CALCULATED:', result) // Debug obligatoire
})
```

## 3. Documents de Référence

Les détails de l'architecture et les normes de codage sont externalisés dans des fichiers dédiés. Tu dois adhérer à leurs principes.

-   **`ARCHITECTURE.md`** : C'est ta source de vérité pour tout ce qui concerne la structure du projet, l'héritage des classes (`Tool`, `Tab`), les services disponibles et le modèle d'interaction entre l'IDE et les outils.

-   **`SVELTE5.md`** : C'est ton guide obligatoire pour toutes les règles de syntaxe Svelte 5, les patterns de réactivité (`$state`, `$effect` vs `$derived`) et les anti-patterns à éviter.

## 4. Normes de Codage Générales et Invariables

Ces règles s'appliquent à **tout** le code que tu écris ou modifies, sans exception.

-   **Tests :** NE PAS CODER DE TESTS UNITAIRES, D'INTÉGRATION OU FONCTIONNELS. Le test sera effectué manuellement.

-   **Commentaires :** Ne pas mettre de commentaires ni de docstrings dans le code. Le code doit être auto-explicite.

-   **Simplicité :** Garder le code (boucles, conditions) le plus simple possible. Pas de code mort.

-   **Refactoring :** Lorsque tu changes un comportement existant, assure-toi de supprimer tout le code relié à l'ancien comportement et de vérifier que le reste du code fonctionne correctement.

-   **console minimale :** Utiliser `console.log` uniquement pour le débogage temporaire. Ne pas laisser de logs dans le code final.

## 5. RÈGLE CRITIQUE : Stratégie de Modification Efficiente

**IMPORTANT : Cette règle vise à optimiser l'utilisation des outils de modification de code.**

### ⚠️ INTERDICTION DES MICRO-MODIFICATIONS ⚠️

- **JAMAIS** faire de modifications par petites touches successives
- **TOUJOURS** planifier globalement avant d'exécuter
- **OBLIGATOIRE** : Regrouper les modifications par blocs logiques

### Pourquoi cette interdiction ?

Les micro-modifications coûtent cher en requêtes premium et créent de la confusion. Une série de 20+ petits changements peut être remplacée par 2-3 modifications intelligentes.

### Stratégie Obligatoire pour les Gros Nettoyages

```markdown
## Phase 1 : ANALYSE GLOBALE (1-2 appels d'outils)
- Lire le fichier complet
- Identifier TOUS les points à modifier
- Grouper par zones logiques (ex: constructor, méthodes, utilitaires)

## Phase 2 : MODIFICATION PAR BLOCS (3-5 appels maximum)
- Bloc 1 : Zone constructor + propriétés (lignes 1-50)
- Bloc 2 : Méthodes principales (lignes 51-200)  
- Bloc 3 : Méthodes utilitaires (lignes 201-fin)

## Phase 3 : VALIDATION (1 appel)
- Un seul grep_search final pour vérifier
```

### Règles d'Exécution

1. **Planifier d'abord** : Toujours analyser le fichier avant toute modification
2. **Modifications groupées** : Maximum 5 appels de replace_string_in_file par fichier
3. **Contexte large** : Inclure 5-10 lignes de contexte pour éviter les échecs
4. **Validation finale** : Un seul appel de vérification à la fin

### Anti-Pattern à Éviter

```markdown
❌ MAUVAIS : 22 appels pour nettoyer un fichier
- replace_string_in_file (console.log #1)
- replace_string_in_file (console.log #2)
- replace_string_in_file (commentaire #1)
- replace_string_in_file (commentaire #2)
- ... (18 autres micro-modifications)

✅ BON : 3 appels pour le même nettoyage
- replace_string_in_file (tout le bloc constructor nettoyé)
- replace_string_in_file (toutes les méthodes de restauration nettoyées)
- replace_string_in_file (méthodes utilitaires nettoyées)
```