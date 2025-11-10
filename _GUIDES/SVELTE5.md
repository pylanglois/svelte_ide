# Guide des Bonnes Pratiques Svelte 5

Ce guide définit les normes obligatoires pour l'écriture de code avec Svelte 5. L'objectif est de produire un code moderne, lisible, performant et d'éviter les pièges de réactivité. **Aucune syntaxe legacy n'est autorisée.**

## 1. Les Piliers de la Réactivité : `let`, `$state`, `$derived`, `$effect`

La maîtrise de ces quatre concepts est non négociable.
#
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

## 2. `$derived` : Quand et Comment l'Utiliser

`$derived` est **autorisé** mais nécessite une compréhension approfondie de ses pièges pour éviter les bugs de réactivité.

### ✅ Cas d'Usage VALIDES pour `$derived`

**Règle d'or :** `$derived` fonctionne UNIQUEMENT si toutes les dépendances sont **directes et visibles** dans l'expression.

```javascript
// ✅ BON - Dépendances directes sur des $state
let firstName = $state('Pierre')
let lastName = $state('Langlois')
let fullName = $derived(firstName + ' ' + lastName)

// ✅ BON - Calcul simple avec props
let { items = [] } = $props()
let itemCount = $derived(items.length)

// ✅ BON - Transformation directe
let price = $state(100)
let priceWithTax = $derived(price * 1.15)
```

### ❌ Pièges CRITIQUES avec `$derived`

**1. Dépendances indirectes (accès via méthodes ou propriétés d'objets)**

```javascript
// ❌ DANGEREUX - Svelte peut ne pas détecter la dépendance
let container = $state({ width: 100, height: 50 })
let ratio = $derived(container.width / container.height) // ⚠️ Peut ne pas se mettre à jour !

// ✅ SOLUTION - Utiliser $effect + $state
let ratio = $state(0)
$effect(() => {
  ratio = container.width / container.height
})
```

**2. Appels de méthodes dans le calcul**

```javascript
// ❌ DANGEREUX - La méthode peut cacher des dépendances
let activeTool = $state(someTool)
let toolName = $derived(activeTool.getName()) // ⚠️ Réactivité non garantie !

// ✅ SOLUTION - Accès direct à la propriété
let toolName = $derived(activeTool.name)

// ✅ OU utiliser $effect si la méthode est nécessaire
let toolName = $state('')
$effect(() => {
  toolName = activeTool.getName()
})
```

**3. Logging de valeurs `$derived`**

```javascript
// ⚠️ ATTENTION - Ne PAS logger directement un $state dans $effect
let value = $state(10)
$effect(() => {
  console.log('value:', value) // ⚠️ Warning: logging $state proxy
})

// ✅ SOLUTION - Utiliser $state.snapshot()
$effect(() => {
  console.log('value:', $state.snapshot(value))
})

// ✅ OU utiliser $inspect() (recommandé pour debugging)
$inspect('value', value)
```

### 🎯 Décision : `$derived` vs `$effect` + `$state`

| Critère | Utiliser `$derived` | Utiliser `$effect` + `$state` |
|---------|---------------------|-------------------------------|
| Dépendances | Directes et simples | Indirectes ou complexes |
| Calcul | Pure transformation synchrone | Logique conditionnelle ou appels de méthodes |
| Debugging | Pas besoin de logs | Besoin de tracer les changements |
| Props avec fallbacks | ✅ Idéal | Overkill |
| Services/Stores | ❌ Risqué | ✅ Préférable |

### 📝 Exemples Comparatifs

```javascript
// CAS 1: Props simples avec fallbacks
// ✅ $derived est parfait ici
let { label = 'Défaut', className = '' } = $props()
const resolvedLabel = $derived(label ?? 'Défaut')
const resolvedClass = $derived(className ?? '')

// ❌ $effect serait du overkill
let resolvedLabel = $state('Défaut')
$effect(() => {
  resolvedLabel = label ?? 'Défaut'
})

// CAS 2: Accès à des services
// ❌ $derived risqué (dépendances indirectes possibles)
const sections = $derived(statusBarService.sections)

// ✅ $effect préférable
let sections = $state({ left: [], center: [], right: [] })
$effect(() => {
  sections = statusBarService.sections
})

// CAS 3: Calculs purs sur $state
// ✅ $derived excellent
let items = $state([1, 2, 3])
let total = $derived(items.reduce((a, b) => a + b, 0))

// CAS 4: Transformation avec objet complexe
// ❌ $derived peut échouer
let branding = $state({ component: MyComp, props: {} })
const resolved = $derived(normalizeBranding(branding)) // ⚠️ Risqué !

// ✅ $effect sûr
let resolved = $state(null)
$effect(() => {
  resolved = normalizeBranding(branding)
})

## 3. Synchronisation avec la persistance & l'hydratation

- Utilisez **toujours** `eventBus.subscribe('persistence:ready', ...)` pour différer la lecture des données chiffrées. L'événement arrive après que `indexedDBService` **et** `binaryStorageService` aient reçu la clé.
- Préférez `await indexedDBService.readyForEncryption({ timeoutMs })` dans vos bootstraps asynchrones. Gérez le rejet (timeout) pour basculer en mode dégradé et écouter `persistence:error`.
- Les restaurations d'outils doivent se brancher sur `hydration:before` (préparation, caches, vérifications) et `hydration:after` (nettoyage). Ne persistez rien pendant la fenêtre `hydration:before → hydration:after` afin d'éviter les snapshots incomplets.

## 3. Éviter les Boucles Infinies avec `$effect`

**⚠️ DANGER CRITIQUE :** Les boucles infinies sont le piège #1 avec `$effect`. L'historique du projet montre plusieurs incidents majeurs causés par ce problème.

### ❌ Anti-Pattern #1 : Lecture ET Modification de la Même Variable

**LE PLUS DANGEREUX** - Cause immédiate de boucle infinie

```javascript
// ❌ TOTALEMENT INTERDIT - Boucle infinie garantie
let content = $state('')

$effect(() => {
  const value = content  // LIT content
  content = value.trim() // MODIFIE content → relance l'effet → boucle infinie!
})
```

**Symptôme :** `Maximum update depth exceeded`

**Solution :** Séparer la lecture et l'écriture avec un garde

```javascript
// ✅ CORRECT - Garde pour éviter la boucle
let content = $state('')
let isInitialized = $state(false)

$effect(() => {
  if (!isInitialized && content) {
    content = content.trim()
    isInitialized = true
  }
})
```

### ❌ Anti-Pattern #2 : Effets en Cascade

**Multiples `$effect` qui se déclenchent mutuellement**

```javascript
// ❌ DANGEREUX - Risque de cascade infinie
let panelsCount = $state(0)
let isActive = $state(false)

$effect(() => {
  isActive = panelsCount > 0 // Modifie isActive
})

$effect(() => {
  if (isActive) {
    panelsCount++ // Modifie panelsCount → relance le premier effet
  }
})
```

**Solution :** Consolider les effets ou utiliser des gardes

```javascript
// ✅ CORRECT - Un seul effet
let panelsCount = $state(0)
let isActive = $state(false)

$effect(() => {
  const shouldBeActive = panelsCount > 0
  if (isActive !== shouldBeActive) {
    isActive = shouldBeActive
  }
})
```

### ❌ Anti-Pattern #3 : Effect sans Dépendances Claires

**Modification d'état qui devrait être dérivé**

```javascript
// ❌ MAUVAIS - State mis à jour en permanence
let items = $state([1, 2, 3])
let total = $state(0)

$effect(() => {
  total = items.reduce((a, b) => a + b, 0) // Se relance à chaque update
})
```

**Solution :** Utiliser `$derived` quand c'est approprié

```javascript
// ✅ CORRECT - Calcul dérivé pur
let items = $state([1, 2, 3])
let total = $derived(items.reduce((a, b) => a + b, 0))
```

### 🛡️ Bonnes Pratiques pour `$effect`

1. **Ne JAMAIS lire et modifier la même variable** dans un `$effect`
2. **Utiliser des gardes** (`if (!initialized)`, `if (value !== newValue)`)
3. **Consolider les effets** plutôt que de créer des cascades
4. **Préférer `$derived`** pour les calculs purs
5. **Toujours nettoyer** les timers/abonnements avec `return () => cleanup()`

### 📋 Checklist de Debugging de Boucle Infinie

Si vous voyez `Maximum update depth exceeded` :

1. ✅ Identifiez quel `$effect` est en cause (ajoutez des logs temporaires)
2. ✅ Vérifiez si l'effet LIT et MODIFIE la même variable
3. ✅ Cherchez les cascades entre plusieurs effets
4. ✅ Ajoutez un garde pour éviter les modifications inutiles
5. ✅ Envisagez de remplacer par `$derived` si c'est un calcul pur

## 4. Debugging Svelte 5 : Outils et Techniques

### `$inspect()` - L'Outil de Debugging Natif

**Recommandation Svelte 5 officielle** pour inspecter les valeurs réactives

```javascript
// ✅ MEILLEURE PRATIQUE - $inspect() natif
let user = $state({ name: 'Alice', age: 30 })
$inspect('user', user) // Affiche dans la console quand user change

// ✅ Avec condition DEV uniquement
if (import.meta.env.DEV) {
  $inspect('sections', sections)
}

// ✅ Inspecter plusieurs valeurs
$inspect('state', { user, items, total })
```

**Avantages :**
- ✅ Pas de warning sur les proxies `$state`
- ✅ Affichage automatique quand la valeur change
- ✅ Interface native de Svelte dans la console
- ✅ Peut être conditionné au mode DEV

### `$state.snapshot()` - Pour les Logs Manuels

**Quand utiliser :** Logs dans `$effect` ou debugging ponctuel

```javascript
// ✅ CORRECT - Snapshot pour éviter les warnings
let items = $state([1, 2, 3])

$effect(() => {
  console.log('Items changed:', $state.snapshot(items))
})

// ✅ Logs conditionnels en production
$effect(() => {
  sections = statusBarService.sections
  if (import.meta.env.DEV) {
    console.log('Sections updated:', $state.snapshot(sections))
  }
})
```

**⚠️ Ne PAS faire :**

```javascript
// ❌ MAUVAIS - Warning: logging $state proxy
let value = $state(10)
$effect(() => {
  console.log('value:', value) // ⚠️ Warning!
})
```

### Stratégie de Debugging par Niveau

#### Niveau 1 : Debugging Actif (Développement)
```javascript
// Utiliser $inspect() pour voir les changements en temps réel
$inspect('myState', myState)
```

#### Niveau 2 : Logs Permanents (Développement uniquement)
```javascript
// Logs conditionnels avec $state.snapshot()
if (import.meta.env.DEV) {
  $effect(() => {
    console.log('State:', $state.snapshot(myState))
  })
}
```

#### Niveau 3 : Traces Production (Sélectif)
```javascript
// Seulement pour les erreurs critiques
try {
  // ...
} catch (error) {
  console.error('Critical error:', error, $state.snapshot(currentState))
}
```

### Debugging de Réactivité

**Problème :** Une valeur ne se met pas à jour

```javascript
// ✅ Tester si la dépendance est détectée
let computed = $state(0)

$effect(() => {
  computed = source.value
  console.log('Effect ran!', computed) // Si ça ne s'affiche pas → problème
})

// ✅ Tester avec $inspect
$inspect('source.value', source.value)
$inspect('computed', computed)
```

**Si `$inspect` ne se déclenche pas :** Dépendance indirecte non détectée → migrer vers `$effect`

### Debugging de Boucle Infinie

**Problème :** `Maximum update depth exceeded`

```javascript
// ✅ Ajouter des logs pour identifier l'effet coupable
$effect(() => {
  console.log('Effect 1 running')
  // ... votre code
})

$effect(() => {
  console.log('Effect 2 running')
  // ... votre code
})

// Cherchez lequel se répète infiniment dans la console
```

**Solution :** Ajouter des gardes ou consolider les effets

## 6. Exemples Concrets du Projet svelte-ide

### Exemple 1 : StatusBar - Migration Service → State

**Contexte :** Le composant StatusBar doit afficher dynamiquement les sections fournies par `statusBarService`.

#### ❌ AVANT - Tentative avec $derived (ne fonctionnait pas)

```javascript
// statusBarService n'est PAS un $state direct → dépendance indirecte
const sections = $derived(statusBarService.sections)
// ⚠️ Problème : sections.left/right/center ne sont pas détectés comme réactifs
```

#### ✅ APRÈS - Migration vers $effect + $state

```javascript
// StatusBar.svelte
let sections = $state({
  left: [],
  center: [],
  right: []
})

$effect(() => {
  sections = statusBarService.sections
})

// Debugging en mode DEV
if (import.meta.env.DEV) {
  $inspect('StatusBar sections', sections)
}
```

**Pourquoi ça fonctionne :**
- `statusBarService.sections` change quand un composant s'enregistre/désenregistre
- `$effect` détecte le changement et met à jour `sections` (local `$state`)
- Les templates Svelte voient le `$state` local → réactivité garantie

---

### Exemple 2 : TitleBar - Props Complexes avec Composants

**Contexte :** Le composant TitleBar reçoit une prop `branding` qui peut être `{ component, props }` et doit l'afficher dynamiquement.

#### ❌ AVANT - $derived sur objet complexe

```javascript
const brandingComponent = $derived(branding?.component)
const brandingProps = $derived(branding?.props ?? {})
// ⚠️ Warning: console.log contenait des proxies $state
```

#### ✅ APRÈS - $effect avec $state séparés

```javascript
// TitleBar.svelte
let { branding = $bindable() } = $props()

let brandingComponent = $state(null)
let brandingProps = $state({})

$effect(() => {
  brandingComponent = branding?.component ?? null
  brandingProps = branding?.props ?? {}
})

if (import.meta.env.DEV) {
  $inspect('TitleBar branding', { brandingComponent, brandingProps })
}
```

**Bénéfices :**
- Séparation claire : `component` et `props` sont des `$state` indépendants
- `$inspect()` au lieu de `console.log` → pas de warnings sur les proxies
- Code plus explicite : on voit clairement ce qui change

---

### Exemple 3 : ActiveTabItem - Cas Valide pour $derived

**Contexte :** Un composant simple qui affiche une icône et un libellé avec des valeurs par défaut.

#### ✅ CORRECT - $derived pour props simples

```javascript
// ActiveTabItem.svelte
let { icon = $bindable(), label = $bindable(), title = $bindable() } = $props()

const resolvedIcon = $derived(icon ?? 'file-text')
const resolvedLabel = $derived(label ?? 'No file selected')
const resolvedTitle = $derived(title ?? resolvedLabel)
```

**Pourquoi $derived est approprié ici :**
- ✅ Dépendances directes sur les props (pas de service)
- ✅ Calculs purs et simples (fallbacks uniquement)
- ✅ Pas d'effets de bord
- ✅ Performance optimale (réévaluation minimale)

**Règle :** Si vous voyez seulement `props.X ?? defaultValue`, `$derived` est le bon choix.

---

### Exemple 4 : App.svelte - Normalisation de Props Optionnelles

**Contexte :** Le composant racine accepte une prop `branding` qui peut être `undefined`, `null`, ou `{ component, props }`.

#### ❌ AVANT - $derived avec fonction helper

```javascript
const resolvedBranding = $derived(normalizeBranding(branding))

function normalizeBranding(b) {
  if (!b?.component) return null
  return { component: b.component, props: b.props ?? {} }
}
```

#### ✅ APRÈS - $effect + $state

```javascript
// App.svelte
let { branding = $bindable() } = $props()

let resolvedBranding = $state(null)

$effect(() => {
  resolvedBranding = normalizeBranding(branding)
})

function normalizeBranding(b) {
  if (!b?.component) return null
  return { component: b.component, props: b.props ?? {} }
}

if (import.meta.env.DEV) {
  $inspect('App resolvedBranding', resolvedBranding)
}
```

**Justification :**
- La prop `branding` contient un **objet complexe** avec un composant Svelte
- La fonction `normalizeBranding()` retourne un nouvel objet → pas de calcul pur
- `$effect` permet d'ajouter facilement `$inspect()` pour le debugging

---

### Récapitulatif des Patterns

| Composant | Pattern | Raison |
|-----------|---------|--------|
| StatusBar | `$effect` + `$state` | Service externe (`statusBarService.sections`) |
| TitleBar | `$effect` + `$state` | Objet complexe avec composant + props |
| ActiveTabItem | `$derived` | Props simples avec fallbacks |
| ClockItem | `$derived` | Props simples avec fallbacks |
| StatusMessageItem | `$derived` | Props simples avec fallbacks |
| App | `$effect` + `$state` | Objet complexe avec fonction de normalisation |

**Conclusion :** La décision `$derived` vs `$effect` dépend de la **source de données** (props vs service) et de la **complexité du calcul** (pure vs side-effect).

## 7. Composants : Props, Événements et Cycle de Vie

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
