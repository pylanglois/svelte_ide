# Instructions Principales pour l'IA

Ce document contient les règles fondamentales et non négociables pour ce projet.

## 1. La Règle d'Or : La Séparation des Responsabilités

**LA SÉPARATION STRICTE ENTRE LE CŒUR DE L'IDE (`src/core`, `src/stores`, `src/components/layout`) ET LES OUTILS (`src/test_tools`) EST LA RÈGLE LA PLUS IMPORTANTE DE CE PROJET.**

-   L'IDE ne doit **jamais** dépendre d'un outil spécifique.
-   Les outils ne doivent interagir avec l'IDE **que** via les services exposés (principalement via `ideStore`).

## 2. Documents de Référence

Les détails de l'architecture et les normes de codage sont externalisés dans des fichiers dédiés. Tu dois adhérer à leurs principes.

-   [ARCHITECTURE.md](/_GUIDES/ARCHITECTURE.md) : C'est ta source de vérité pour tout ce qui concerne la structure du projet, l'héritage des classes (`Tool`, `Tab`), les services disponibles et le modèle d'interaction entre l'IDE et les outils.

-   [SVELTE5.md](/_GUIDES/SVELTE5.md) : C'est ton guide obligatoire pour toutes les règles de syntaxe Svelte 5, les patterns de réactivité (`$state`, `$effect` vs `$derived`) et les anti-patterns à éviter.

## 3. Normes de Codage Générales et Invariables

Ces règles s'appliquent à **tout** le code que tu écris ou modifies, sans exception.

-   **Tests :** NE PAS CODER DE TESTS UNITAIRES, D'INTÉGRATION OU FONCTIONNELS. Le test sera effectué manuellement.

-   **Commentaires :** Ne pas mettre de commentaires ni de docstrings dans le code. Le code doit être auto-explicite.

-   **Simplicité :** Garder le code (boucles, conditions) le plus simple possible. Pas de code mort.

-   **Refactoring :** Lorsque tu changes un comportement existant, assure-toi de supprimer tout le code relié à l'ancien comportement et de vérifier que le reste du code fonctionne correctement.
