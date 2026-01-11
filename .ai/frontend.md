# Frontend Standards (Svelte 5)

> Standards for Svelte 5 Runes development

## Svelte 5 Norms

**Strict Syntax:**
- Runes only: `$state`, `$derived`, `$effect`, `$props()`
- FORBIDDEN: `export let`, `$:`, `on:`, `createEventDispatcher`
- Props: always `let { myProp } = $props()`
- Events: callbacks only (`onclick`, `onAction`)

**Self-Documenting Code:**
- No comments
- No docstrings
- Explicit names (variables, functions, components)
- Short and focused components

**Organization:**
- Components < 150 lines, otherwise split
- camelCase for variables (JavaScript standard)
- No try/catch except upon explicit request

## Reactivity: $derived vs $effect

**Use $derived WHEN:**
- ✅ DIRECT dependencies visible in the expression
- ✅ PURE and synchronous computations
- ✅ Simple props with fallbacks

```javascript
let firstName = $state('Pierre')
let lastName = $state('Langlois')
let fullName = $derived(firstName + ' ' + lastName)

let { icon } = $props()
let resolvedIcon = $derived(icon ?? 'file-text')
```

**Use $effect + $state WHEN:**
- ✅ INDIRECT dependencies (services, stores, methods)
- ✅ Complex computations requiring logging/debugging
- ✅ Method calls: `obj.getName()` vs `obj.name`

```javascript
let sections = $state({ left: [], center: [], right: [] })
$effect(() => {
  sections = statusBarService.sections
})

let ratio = $state(0)
$effect(() => {
  ratio = container.width / container.height
  console.log('ratio:', ratio)
})
```

## Avoiding Infinite Loops

**Critical Rule:**
NEVER read AND modify the same variable in `$effect`

```javascript
// ❌ FORBIDDEN - Infinite loop
let content = $state('')
$effect(() => {
  content = content.trim()  // READS and MODIFIES content → loop!
})

// ✅ CORRECT - Guard to avoid loop
let content = $state('')
let initialized = $state(false)
$effect(() => {
  if (!initialized && content) {
    content = content.trim()
    initialized = true
  }
})
```

## Debugging

**$inspect() - Preferred:**
```javascript
let user = $state({ name: 'Alice' })
$inspect('user', user)
```

**$state.snapshot() - Manual logs:**
```javascript
$effect(() => {
  console.log('Items:', $state.snapshot(items))
})
```

**FORBIDDEN - Direct console.log:**
```javascript
// ❌ Proxy warning
$effect(() => {
  console.log('value:', value)  // ⚠️ Don't do this!
})
```

## Recommended Code Order

**Svelte component structure:**
```svelte
<script>
// 1. Imports
import { sideStore } from '@svelte-ide/core'

// 2. Props
let { title, items = [] } = $props()

// 3. Local state ($state)
let selected = $state(null)
let expanded = $state(false)

// 4. Derived computations ($derived)
let filteredItems = $derived(items.filter(i => i.active))

// 5. Effects ($effect)
$effect(() => {
  if (items.length > 0 && !selected) {
    selected = items[0]
  }
})

// 6. Functions
function handleClick() {
  expanded = !expanded
}

// 7. Snippets (if necessary)
</script>

<!-- 8. Markup -->
<div>...</div>

<!-- 9. Styles -->
<style>...</style>
```

## SIDE Tool Pattern

**Simple Tool:**
```
tools/simple-tool/
├── index.svelte.js       # Definition
└── SimplePanel.svelte    # View
```

**Complex Tool (Controller + Stores):**
```
tools/document-library/
├── index.svelte.js                 # Tool definition
├── DocumentLibraryPanel.svelte     # "Dumb" view
├── documentLibraryController.svelte.js # Orchestration
├── stores/
│   ├── dataStore.svelte.js        # Source of truth
│   └── viewStateStore.svelte.js   # UI state
└── utils/
    └── treeBuilder.js             # Pure functions
```

**Responsibilities:**
- Panel: displays data from controller
- Controller: orchestrates actions, facade
- dataStore: Map/Set with business data
- viewStateStore: selection, UI expansion
- utils: pure transformation functions

## Props and Events

**Props:**
```javascript
// ✅ CORRECT
let { title, onClose } = $props()

// ❌ FORBIDDEN
export let title
```

**Events (Callbacks):**
```javascript
// ✅ Parent
<Modal onClose={() => closeModal()} />

// ✅ Child
let { onClose } = $props()
<button onclick={onClose}>Close</button>

// ❌ FORBIDDEN
const dispatch = createEventDispatcher()
on:close={handler}
```

## Lifecycle

**Mounting:**
```javascript
let data = $state(null)
fetchData()  // <script> body executes on mount
```

**Cleanup:**
```javascript
$effect(() => {
  const timer = setInterval(() => tick(), 1000)
  return () => clearInterval(timer)  // Cleanup
})
```

## Strict Rules

- ✅ `onclick={handler}` — ❌ `on:click={handler}`
- ✅ `{@render snippet}` — ❌ `<svelte:component>`
- ✅ Direct mutation `$state`: `items.push(x)`
- ❌ NEVER destructure `$state` object (loses reactivity)

## Local Storage

**Encrypted IndexedDB:**
- AES-256-GCM via Web Crypto API
- All client-side user data
- Export/import for backup

## Testing

Manual testing only. No coded tests by AI without explicit request.

## Simplicity Checklist

1. Component < 150 lines? Otherwise split
2. $derived possible or $effect necessary?
3. No infinite loop (read AND modify)?
4. Explicit variable names?
5. Necessary abstraction or over-engineering?
