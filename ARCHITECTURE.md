# Architecture de l'IDE Svelte

Ce document décrit l'architecture fondamentale du framework d'IDE basé sur Svelte 5. Il est destiné aux développeurs qui souhaitent comprendre le fonctionnement interne du système et créer leurs propres outils.

## Le Concept Fondamental : IDE vs Outils

L'architecture repose sur une **séparation stricte** entre le **cœur de l'IDE** et les **Outils**.

-   **L'IDE** : C'est la coquille, le conteneur. Il ne connaît aucune fonctionnalité métier spécifique. Ses seules responsabilités sont de :
    1.  Fournir une structure d'interface (panneaux, barres d'outils, onglets).
    2.  Gérer l'état global de l'application (quel outil est actif, quels onglets sont ouverts, etc.).
    3.  Exposer des services (API) que les outils peuvent consommer (ex: "ajoute un onglet", "envoie une notification").
    4.  Charger dynamiquement les outils disponibles dans le dossier `src/tools`.

-   **Les Outils** : Ce sont des modules indépendants et isolés qui implémentent des fonctionnalités spécifiques (par exemple, un explorateur de fichiers, un terminal, une calculatrice).
    1.  Ils sont "ignorants" de l'architecture globale de l'IDE.
    2.  Ils consomment les services fournis par l'IDE pour s'intégrer à l'interface.
    3.  Un outil peut être ajouté ou supprimé du dossier `src/tools` sans jamais casser le cœur de l'IDE.

Cette séparation garantit une **modularité** et une **extensibilité** maximales.

---

## Structure du Projet

Les responsabilités sont clairement délimitées par la structure des dossiers :

-   `src/core/` : Le moteur de l'IDE. Contient les classes et services de base.
-   `src/stores/` : L'état global et réactif de l'application.
-   `src/components/layout/` : Les composants Svelte qui constituent l'interface de l'IDE.
-   `src/tools/` : Le répertoire où les développeurs créent leurs propres outils.
-   `App.svelte` : Le composant racine qui assemble l'application.

---

## Détail des Composants Clés

### 1. `src/stores/ideStore.svelte.js` : Le Cerveau de l'Application

C'est le fichier le plus important pour comprendre le fonctionnement de l'IDE. Il agit comme la **source unique de vérité** pour l'ensemble de l'application.

-   **Rôle** : Il centralise tout l'état réactif de l'IDE en utilisant les "runes" de Svelte 5 (`$state`, `$derived`).
-   **État géré** :
    -   La liste de tous les outils enregistrés (`tools`).
    -   Les outils actuellement actifs dans chaque panneau (`activeToolsByPosition`).
    -   La liste des onglets ouverts dans la vue principale (`tabs`).
    -   L'onglet actuellement actif (`activeTab`).
    -   Les notifications, les logs de la console, l'état de l'utilisateur, etc.
-   **API pour les Outils** : Il expose des méthodes qui forment l'API principale pour les outils. Par exemple :
    -   `ideStore.addTab(...)` : Pour qu'un outil ouvre un nouvel onglet.
    -   `ideStore.addNotification(...)` : Pour afficher une notification.
    -   `ideStore.addLog(...)` : Pour écrire dans la console système.
    -   `ideStore.toggleTool(...)` : Pour activer/désactiver un outil.

**Un développeur d'outils interagira principalement avec `ideStore` pour intégrer son outil à l'IDE.**

### 2. Le Bus d'Événements (`eventBus`)

Pour la communication découplée entre les outils, ou entre l'IDE et les outils.

-   **Principe :** Un composant publie un événement sans savoir qui écoute. D'autres composants s'abonnent à cet événement et réagissent.
-   **Publier un événement :**
    ```javascript
    import { eventBus } from '@/core/EventBusService.svelte.js';
    eventBus.publish('mon-evenement:nom', { maData: 'valeur' });
    ```
-   **S'abonner à un événement (Exemple dans un composant Svelte) :**
    ```javascript
    $effect(() => {
      const unsubscribe = eventBus.subscribe('mon-evenement:nom', (data) => {
        // Mettre à jour un $state ici pour la réactivité
        console.log('Événement reçu:', data);
      });

      // OBLIGATOIRE: Nettoyer l'abonnement à la destruction du composant
      return () => unsubscribe();
    });
    ```
-   **Débogage :** Activez le mode debug via `eventBus.setDebugMode(true)` pour voir tous les événements et leurs données passer dans la console du navigateur.

### 3. `src/core/` : Les Classes de Base et Services

Ce dossier contient la logique "métier" de l'IDE lui-même.

-   `Tool.svelte.js` : La classe de base que tous les outils doivent étendre. Elle définit les propriétés fondamentales d'un outil : `id`, `name`, `icon`, `position`, et son état `active`.
-   `ToolManager.svelte.js` : Le service responsable du chargement des outils. Au démarrage de l'application, il scanne le répertoire `src/tools` à la recherche de fichiers `index.svelte.js`, les importe dynamiquement et appelle leur fonction `register` pour les intégrer à l'IDE.
-   `Tab.svelte.js` : La classe de base pour les onglets, définissant leurs propriétés (ID, titre, composant à rendre, etc.).

### 4. `src/components/layout/` : L'Interface de l'IDE

Ce dossier contient les composants Svelte qui forment la structure visuelle de l'IDE. Ces composants sont "passifs" : leur rôle est de lire l'état depuis `ideStore` et de l'afficher.

-   `Toolbar.svelte` : Lit la liste des outils depuis `ideStore` et affiche les icônes correspondantes.
-   `ToolPanel.svelte` : Lit quel outil est actif pour sa position (`ideStore.activeToolsByPosition`) et rend le composant de cet outil.
-   `MainView.svelte` : Lit la liste des onglets (`ideStore.tabs`) pour afficher la barre d'onglets et rend le composant de l'onglet actif (`ideStore.activeTab`).

Ces composants ne contiennent aucune logique métier. Ils sont uniquement responsables du rendu de l'état.

### 5. `App.svelte` : Le Point d'Entrée

C'est le composant racine qui assemble toutes les pièces du puzzle.

-   **Initialisation** : Au montage, il lance le chargement des outils via `toolManager.loadTools()`.
-   **Assemblage de l'interface** : Il intègre tous les composants `layout` (`TitleBar`, `Toolbar`, `MainView`, etc.) pour former l'application complète.
-   **Logique de l'interface globale** : Il gère des interactions qui affectent toute l'interface, comme le redimensionnement des panneaux.

---

## Le Cycle de Vie d'un Outil : Résumé pour le Développeur

1.  **Création** : Le développeur crée un nouveau dossier dans `src/tools/mon-outil/`.
2.  **Point d'entrée** : Il crée un fichier `index.svelte.js` qui exporte une fonction `register(toolManager)`.
3.  **Enregistrement** : Dans cette fonction, il instancie son outil (une classe qui hérite de `Tool`) et l'enregistre via `toolManager.registerTool(monOutil)`.
4.  **Composant UI** : Il crée un composant Svelte (`MonOutil.svelte`) qui représente l'interface de son outil.
5.  **Liaison** : Dans la méthode `initialize()` de sa classe d'outil, il lie le composant à l'outil avec `this.setComponent(MonOutil)`.
6.  **Interaction** : Depuis son composant ou sa classe, il peut appeler les méthodes de `ideStore` (ex: `ideStore.addTab(...)`) pour interagir avec le reste de l'IDE.

En suivant ce modèle, l'outil est automatiquement découvert et intégré à l'IDE au démarrage, tout en restant complètement découplé du code du cœur.

## Principes transverses
- Observer en priorité les conventions déjà présentes dans la base de code avant d’appliquer de nouvelles règles
- Respecter la règle de langage : code et noms de fichiers en anglais, commentaires et libellés UI en français
- Favoriser le principe KISS : écrire le minimum de code nécessaire, éviter les couches d'abstraction inutiles et n'introduire qu'une classe ou un module supplémentaire apportant un bénéfice clair
- Écrire et conserver les fichiers en UTF-8 SANS BOM afin de préserver les accents et caractères spéciaux. Les fichiers doivent être encodés avec des "LF". **INTERDIT AU CRLF**, **BOM INTERDIT**