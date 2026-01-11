# Svelte 5 Validation

> **CRITICAL:** Invalid Svelte 5 code caused countless issues in the legacy project. These rules are ABSOLUTE.

## BEFORE Writing Svelte Code

**1. Consult `_GUIDES/SVELTE5_PATTERNS.md`** for validated patterns in detail

**2. MANDATORY Checklist:**
- [ ] No `export let` (use `$props()`)
- [ ] No `$:` for reactivity (use `$derived` or `$effect`)
- [ ] No `on:event` (use `onclick`, `onchange`, etc.)
- [ ] No `createEventDispatcher()` (use callbacks)
- [ ] No import `svelte/store` (use `$state`)
- [ ] `$derived` = pure computations with DIRECT dependencies only
- [ ] `$effect` = INDIRECT dependencies or side effects
- [ ] `$effect` NEVER modifies what it observes (avoid infinite loops)
- [ ] `$effect` has cleanup (`return () => {}`) if necessary

**3. Reactivity Decision Tree:**
```
Need reactivity?
├─ Pure computation + DIRECT dependencies? → $derived
└─ Service/method/async/subscription? → $effect + $state
```

**4. In case of DOUBT:**
- **STOP** - Don't code
- Request user confirmation
- Propose 2-3 approaches with their trade-offs

**5. FORBIDDEN Anti-patterns:**
```javascript
// ❌ NEVER
let x = $derived(service.get())           // Non-reactive service
let count = $state(0)
$effect(() => { count++ })                 // Infinite loop
$effect(() => { subscribe() })             // No cleanup
```

**6. Post-Code Validation:**
After writing Svelte code, verify:
- `npm run validate` passes
- No browser console warnings
- No infinite loops
- Reactivity works as expected

## Quick Reference

**Props:**
```javascript
let { title, count = 0, onAction } = $props()
```

**Local state:**
```javascript
let items = $state([])
```

**Pure computation:**
```javascript
let total = $derived(items.length)
```

**Service/Async:**
```javascript
let data = $state(null)
$effect(() => {
  data = service.getData()
})
```

**Cleanup:**
```javascript
$effect(() => {
  const unsub = eventBus.subscribe('event', handler)
  return () => unsub()
})
```

## Debugging Svelte 5

**$inspect() - PREFERRED:**
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

**❌ FORBIDDEN - Direct console.log:**
```javascript
$effect(() => {
  console.log('value:', value)  // ⚠️ Proxy warning!
})
```

## Avoiding Infinite Loops

**Common Examples:**

```javascript
// ❌ LOOP - Reads and modifies content
let content = $state('')
$effect(() => {
  content = content.trim()
})

// ✅ CORRECT - Guard
let content = $state('')
let initialized = $state(false)
$effect(() => {
  if (!initialized && content) {
    content = content.trim()
    initialized = true
  }
})

// ❌ LOOP - Modifies what it observes
let items = $state([])
$effect(() => {
  items.push('new')
})

// ✅ CORRECT - Reacts to external change
let items = $state([])
let externalData = $state([])
$effect(() => {
  items = externalData.map(d => d.name)
})
```

## Recommended Code Order

```svelte
<script>
// 1. Imports
import { sideStore } from '@svelte-ide/core'

// 2. Props
let { title, items = [] } = $props()

// 3. Local state ($state)
let selected = $state(null)

// 4. Derived computations ($derived)
let filtered = $derived(items.filter(i => i.active))

// 5. Effects ($effect)
$effect(() => {
  if (items.length > 0 && !selected) {
    selected = items[0]
  }
})

// 6. Functions
function handleClick() {
  selected = null
}
</script>

<div>...</div>
```

## Svelte 5 Syntax

### ✅ ALLOWED
```javascript
$state, $derived, $effect, $props, $bindable, $inspect
let { prop } = $props()
onclick={() => {}}
bind:value={variable}
```

### ❌ FORBIDDEN
```javascript
export let prop              // ❌ Legacy
$: reactive = value          // ❌ Legacy
on:click={handler}           // ❌ Legacy
createEventDispatcher()      // ❌ Legacy
import { writable } from 'svelte/store'  // ❌ Legacy
```
