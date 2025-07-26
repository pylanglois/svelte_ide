# Leçons de Drag & Drop : Un Cas d'Étude sur la Réactivité de Svelte 5

Ce document retrace le processus de développement et de débogage de la fonctionnalité de glisser-déposer des outils dans la barre d'outils. C'est un excellent cas pratique pour comprendre en profondeur le fonctionnement de la réactivité avec les Runes de Svelte 5, ses pièges et les solutions robustes.

## 1. L'Objectif : Un Drag & Drop Dynamique

L'objectif était de permettre à l'utilisateur de déplacer une icône d'outil d'une section de la barre d'outils (ex: en haut à gauche) à une autre (ex: en bas à gauche, ou en haut à droite) via un glisser-déposer, et que l'interface se mette à jour en conséquence.

## 2. La Stratégie de Base (Les Fondations Correctes)

Dès le départ, plusieurs choix d'architecture étaient corrects et ont constitué notre base :

-   **Utilisation de l'API HTML5 Drag & Drop :** Les événements comme `draggable="true"`, `ondragstart`, `ondragover`, `ondragleave` et `ondrop` sont le standard pour gérer l'interaction dans le DOM.
-   **État Centralisé :** La décision de gérer l'état de l'opération de glisser-déposer dans le store central (`ideStore`) était la bonne. Des variables comme `draggedTool` (quel outil est déplacé) et `dragOverZone` (quelle zone est survolée) permettent de piloter l'interface de manière cohérente.
-   **Une Méthode de Mutation Unique :** L'existence d'une méthode `ideStore.moveTool(toolId, newPosition)` pour effectuer le changement d'état était également une bonne pratique, centralisant la logique de modification.

Le problème n'était donc pas dans l'architecture générale, mais dans les détails fins de la réactivité.

## 3. La Première Tentative et son Échec : Le Piège du `$derived` dans le Store

Notre première approche pour afficher les outils dans `Toolbar.svelte` reposait sur des listes calculées directement dans `ideStore.svelte.js`.

-   **La Stratégie :**
    ```javascript
    // Dans ideStore.svelte.js
    class IDEStore {
      tools = $state([...]);
      
      // Créer des listes filtrées avec $derived
      topLeftTools = $derived(this.tools.filter(t => t.position === 'topLeft'));
      // ... autres listes
    }
    ```
    L'idée était que lorsque `moveTool` changerait la propriété `tool.position`, les listes `$derived` se mettraient à jour automatiquement.

-   **Pourquoi ça a Échoué : La Mutation "Profonde"**
    Le compilateur Svelte est très performant car il est très optimisé. Le `$derived` ne se recalcule que si ses dépendances directes changent. Ici, la dépendance est le tableau `this.tools`.
    
    Quand nous faisions `tool.position = 'newPosition'`, nous ne modifions **pas** le tableau `this.tools` lui-même. Nous modifions une propriété **à l'intérieur** d'un des objets du tableau. Du point de vue de Svelte, le tableau `tools` contient toujours les mêmes références d'objets. Le changement est trop "profond" pour qu'il soit détecté par ce `$derived`. La mise à jour n'a donc jamais lieu.

## 4. La Deuxième Tentative et son Échec : La Chaîne de Réactivité Brisée

Conscients du piège du `$derived`, nous avons rendu la mise à jour du store manuelle et explicite.

-   **La Stratégie :**
    ```javascript
    // Dans ideStore.svelte.js
    class IDEStore {
      topLeftTools = $state([]); // Remplacer $derived par $state
      
      _updateToolLists() { // Créer une méthode de mise à jour manuelle
        this.topLeftTools = this.tools.filter(t => t.position === 'topLeft');
      }

      moveTool(toolId, newPosition) {
        // ...
        this._updateToolLists(); // Appeler la mise à jour
      }
    }
    ```
    La logique **à l'intérieur du store était maintenant parfaite et robuste**. Mais le problème persistait.

-   **Pourquoi ça a Échoué : La Consommation Non Réactive**
    Le bug s'était déplacé dans le composant `Toolbar.svelte`. Nous lisions l'état du store de cette manière :
    ```javascript
    // Dans Toolbar.svelte
    const topTools = ideStore.topLeftTools; 
    ```
    Cette ligne est une assignation JavaScript standard. Elle est exécutée **une seule fois** à la création du composant. Elle prend la valeur de `ideStore.topLeftTools` à cet instant T et la stocke dans la constante `topTools`.
    
    Cette constante `topTools` n'a **aucun lien réactif** avec le store. Quand le store mettait à jour sa propre liste `topLeftTools` (qui était un `$state`), le composant, lui, continuait d'utiliser son "snapshot" initial. La chaîne de réactivité était brisée entre le store et le composant.

## 5. La Solution Finale : Reconnecter la Chaîne

La solution finale combine le meilleur des deux mondes et répare la connexion brisée.

1.  **Le Store (Correct) :** On conserve la logique de la deuxième tentative. Le store gère des listes en `$state` et les met à jour manuellement via `_updateToolLists()`. C'est explicite et fiable.

2.  **Le Composant (Corrigé) :** On change la façon dont `Toolbar.svelte` consomme l'état du store, en utilisant `$derived` **à l'intérieur du composant**.
    ```javascript
    // Dans Toolbar.svelte
    let topTools = $derived(ideStore.topLeftTools);
    ```
    Cette simple modification change tout. Le `$derived` dans le composant crée un **abonnement** au `$state` du store. Maintenant, le flux de données est le suivant :
    -   `onDrop` appelle `ideStore.moveTool()`.
    -   `moveTool()` met à jour la position et appelle `_updateToolLists()`.
    -   `_updateToolLists()` assigne une nouvelle valeur au `$state` `ideStore.topLeftTools`.
    -   Le `$derived` dans `Toolbar.svelte` **détecte ce changement**, se recalcule, et assigne la nouvelle liste à la variable `topTools`.
    -   La boucle `{#each}` dans le template se met enfin à jour avec les bonnes données.

## Résumé des Concepts Clés

-   **`$derived` est pour les calculs, pas pour les mutations profondes :** Utilisez `$derived` lorsque la valeur dépend directement d'autres états réactifs. Pour des structures de données complexes (comme un tableau d'objets), une mise à jour manuelle de l'état est souvent plus sûre.
-   **La Réactivité doit être de bout en bout :** Il ne suffit pas que le store soit réactif. Le composant qui consomme l'état du store doit le faire d'une manière qui crée un abonnement, typiquement en utilisant `$derived` ou `$effect`.
-   **`const` vs `$derived` dans un composant :** Une assignation à une `const` (ou `let` sans rune) depuis un store est un "snapshot" ponctuel. Une assignation via `$derived` est un "abonnement" continu.
-   **Explicite > Implicite :** Face à un bug de réactivité, la stratégie la plus sûre est de rendre chaque étape de la mise à jour de l'état la plus explicite possible, comme nous l'avons fait avec la méthode `_updateToolLists()`.
