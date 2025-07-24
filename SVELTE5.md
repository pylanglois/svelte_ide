# Guide des Bonnes Pratiques Svelte 5

Ce guide définit les normes obligatoires pour l'écriture de code avec Svelte 5. L'objectif est de produire un code moderne, lisible, performant et d'éviter les pièges de réactivité. **Aucune syntaxe legacy n'est autorisée.**

## 1. Les Piliers de la Réactivité : `let`, `$state`, `$derived`, `$effect`

La maîtrise de ces quatre concepts est non négociable.

-   **`let` : Pour les Constantes et Valeurs Statiques**
    -   **Usage :** Uniquement pour les valeurs qui ne changeront **jamais** durant le cycle de vie du composant (fonctions, constantes importées, valeurs initiales non réactives).
    -   **Anti-Pattern :** Utiliser `let` pour une variable qui, si elle changeait, devrait mettre à jour l'interface.

-   **`$state` : Pour l'État Réactif**
    -   **Usage :** **TOUJOURS** utiliser `$state()` pour déclarer toute variable dont le changement doit déclencher une mise à jour de l'interface. C'est la source de vérité pour l'état de vos composants.
    -   **Bonne pratique :** Vous pouvez muter directement les objets et les tableaux déclarés avec `$state`. Inutile de les réassigner (`monArray.push(x)` fonctionne, pas besoin de `monArray = [...monArray, x]`).

-   **`$derived` : Pour les Valeurs Calculées Pures**
    -   **Usage :** Pour déclarer une nouvelle variable dont la valeur est une **combinaison synchrone et pure** d'autres valeurs `$state` ou `$derived`. Svelte optimise ces calculs pour ne les exécuter que lorsque leurs dépendances changent.
    -   **Exemple :** `let nomComplet = $derived(prenom + ' ' + nom);`
    -   **Anti-Pattern :** Mettre des appels API, des `setTimeout`, ou toute autre logique asynchrone ou à effet de bord dans un `$derived`.

-   **`$effect` : Pour les Effets de Bord**
    -   **Usage :** **TOUT** ce qui n'est pas un calcul de valeur pure. C'est le seul endroit autorisé pour les effets de bord en réaction à un changement d'état.
    -   **Exemples :**
        -   Appels API (`fetch`).
        -   Interaction avec `localStorage` ou `document`.
        -   Logging.
        -   Synchronisation avec une librairie externe.
    -   **Nettoyage :** Si un `$effect` crée un abonnement ou un timer, il **doit** retourner une fonction de nettoyage.
        ```javascript
        $effect(() => {
          const timer = setInterval(() => console.log('tick'), 1000);
          return () => clearInterval(timer); // Nettoyage obligatoire
        });
        ```

## 2. Le Piège de `$derived` et Comment l'Éviter (Règle Critique)

L'expérience a montré que le compilateur Svelte peut être trop optimiste avec `$derived`, conduisant à des non-mises à jour si les dépendances sont indirectes.

-   **Le Symptôme :** Une valeur affichée à l'écran ne se met pas à jour alors que ses données sources ont changé.
-   **La Cause :** La dépendance n'est pas directement visible dans l'expression du `$derived` (ex: elle est cachée dans une méthode d'un objet).

-   **La Solution Infaillible : Le "Pattern `$effect` + `$state`"**
    -   En cas de doute ou de bug avec un `$derived`, **ne perdez pas de temps** et refactorez-le immédiatement en utilisant un `$effect` qui met à jour un `$state`. C'est plus verbeux mais **explicite et fiable**.

    -   **Exemple de refactoring :**

        *Version `$derived` (potentiellement piégeuse) :*
        ```javascript
        // Si activeTool est un objet complexe, Svelte pourrait ne pas voir
        // les changements de ses propriétés internes.
        let toolName = $derived(activeTool ? activeTool.getName() : 'Aucun');
        ```

        *Version `$effect` + `$state` (sûre et recommandée) :*
        ```javascript
        let toolName = $state('Aucun');

        $effect(() => {
          // Accès explicite pour garantir la dépendance
          const currentTool = ideStore.activeToolsByPosition[position];
          
          if (currentTool) {
            toolName = currentTool.name;
          } else {
            toolName = 'Aucun';
          }
        });
        ```

## 3. Composants : Props, Événements et Cycle de Vie

-   **Props :**
    -   **Usage :** Récupérez **TOUJOURS** les props avec `let { maProp, autreProp } = $props();`.
    -   **Anti-Pattern :** `export let maProp;` est **interdit**.

-   **Événements (Callbacks) :**
    -   **Usage :** Un composant enfant **DOIT** exposer des props de type fonction (callbacks) pour communiquer avec son parent.
    -   **Exemple :**
        ```javascript
        // Enfant.svelte
        let { onAction } = $props();
        
        // Parent.svelte
        <Enfant onAction={() => console.log('Action!')} />
        ```
    -   **Anti-Pattern :** `createEventDispatcher` et la syntaxe `on:mon-evenement` sont **interdits**.

-   **Cycle de Vie :**
    -   **`onMount` :** Le corps de la balise `<script>` est exécuté une seule fois au montage. C'est le nouvel `onMount`.
    -   **`onDestroy` :** Un `$effect` qui retourne une fonction de nettoyage.
    -   **`beforeUpdate` / `afterUpdate` :** Remplacés par `$effect.pre()` et `await tick()` dans un `$effect`.

## 4. Règles d'Or et Anti-Patterns en Rafale

-   **TOUJOURS** utiliser `onclick={handler}`. **JAMAIS** `on:click={handler}`.
-   **TOUJOURS** utiliser `{@render monComposant}` pour le rendu dynamique. **JAMAIS** `<svelte:component>`.
-   **JAMAIS** de `$:`. Utilisez `$derived` pour les valeurs, `$effect` pour les actions.
-   **JAMAIS** de déstructuration d'un objet `$state` car cela lui fait perdre sa réactivité. Accédez à ses propriétés directement (`monObjet.prop`).
