# Svelte 5 Patterns - Reference Guide

## Absolute Rules

### ✅ ALLOWED

**1. Svelte 5 Runes**
```javascript
$state
$derived
$effect
$props
$bindable
$inspect
```

**2. Modern Syntax**
```javascript
let { prop = 'default' } = $props()
onclick={() => {}}
bind:value={variable}
```

### ❌ FORBIDDEN

**1. Legacy Syntax**
```javascript
export let prop              // ❌ Use $props()
$: reactive = value          // ❌ Use $derived or $effect
on:click={handler}           // ❌ Use onclick
createEventDispatcher()      // ❌ Use callbacks
```

**2. Legacy Imports**
```javascript
import { onMount } from 'svelte'           // ❌ Use $effect
import { writable } from 'svelte/store'    // ❌ Use $state
```

## Reactive Patterns

### $state - Local State

**✅ CORRECT:**
```javascript
let count = $state(0)
let items = $state([])
let user = $state({ name: 'Pierre' })

function increment() {
  count++
}
```

**❌ INCORRECT:**
```javascript
let count = 0  // ❌ Not reactive
```

### $derived - Pure Computations

**When to use:** DIRECT dependencies and PURE computations

**✅ CORRECT:**
```javascript
let firstName = $state('Pierre')
let lastName = $state('Langlois')
let fullName = $derived(firstName + ' ' + lastName)

let items = $state([1, 2, 3])
let total = $derived(items.reduce((a, b) => a + b, 0))

let { label } = $props()
let displayLabel = $derived(label ?? 'Default')
```

**❌ INCORRECT - Indirect dependencies:**
```javascript
let value = $derived(service.getValue())        // ❌ non-reactive service
let result = $derived(obj.method())             // ❌ non-reactive method
let computed = $derived(fetchData())            // ❌ async
```

**❌ INCORRECT - Side effects:**
```javascript
let x = $derived(() => {
  console.log('test')  // ❌ Side effect
  return value * 2
})
```

### $effect - Side Effects and Indirect Dependencies

**When to use:** INDIRECT dependencies, service calls, side effects

**✅ CORRECT:**
```javascript
let result = $state(0)
$effect(() => {
  result = service.getValue()
})

let items = $state([])
$effect(() => {
  items = store.getItems()
})

$effect(() => {
  console.log('Debug:', count)
})

$effect(() => {
  const unsubscribe = eventBus.subscribe('event', handler)
  return () => unsubscribe()  // Cleanup
})
```

**❌ INCORRECT - Infinite loops:**
```javascript
let count = $state(0)
$effect(() => {
  count++  // ❌ INFINITE LOOP - modifies what it observes
})

let items = $state([])
$effect(() => {
  items.push(1)  // ❌ INFINITE LOOP
})
```

**❌ INCORRECT - No cleanup:**
```javascript
$effect(() => {
  eventBus.subscribe('event', handler)
  // ❌ Missing return cleanup
})
```

## Props

**✅ CORRECT:**
```javascript
let { title, count = 0, onAction } = $props()

// With bindable
let { value = $bindable() } = $props()
```

**❌ INCORRECT:**
```javascript
export let title          // ❌ Legacy
export let count = 0      // ❌ Legacy
```

## Events

**✅ CORRECT:**
```javascript
<button onclick={() => count++}>+</button>
<button onclick={handleClick}>Click</button>

// From parent
<Child onAction={handleAction} />

// In Child
let { onAction } = $props()
<button onclick={() => onAction?.()}>Action</button>
```

**❌ INCORRECT:**
```javascript
<button on:click={handler}>Click</button>  // ❌ Legacy

import { createEventDispatcher } from 'svelte'
const dispatch = createEventDispatcher()   // ❌ Legacy
```

## Bindings

**✅ CORRECT:**
```javascript
<input bind:value={text} />
<Child bind:value={data} />
```

## Checklist Before Writing Svelte Code

1. ✅ No `export let`
2. ✅ No `$:` for reactivity
3. ✅ No `on:event`
4. ✅ No imports from `svelte/store`
5. ✅ `$effect` has cleanup if necessary
6. ✅ `$effect` doesn't modify what it observes
7. ✅ `$derived` doesn't make service/method calls
8. ✅ `$derived` is a pure computation without side effects

## Complete Examples

### Simple Component

```svelte
<script>
let count = $state(0)
let doubled = $derived(count * 2)

function increment() {
  count++
}
</script>

<div>
  <p>Count: {count}, Doubled: {doubled}</p>
  <button onclick={increment}>+</button>
</div>
```

### Component with Props

```svelte
<script>
let { title, items = [], onSelect } = $props()

let selectedIndex = $state(0)
let selectedItem = $derived(items[selectedIndex])
</script>

<div>
  <h2>{title}</h2>
  {#each items as item, i}
    <button onclick={() => onSelect?.(item)}>
      {item.name}
    </button>
  {/each}
</div>
```

### Component with Services

```svelte
<script>
import { themeService } from '@svelte-ide/core'

let primaryColor = $state('')

$effect(() => {
  primaryColor = themeService.getColor('primary')
})
</script>

<div style:--color={primaryColor}>
  Themed content
</div>
```

## Common Anti-Patterns

### ❌ $derived with service

```javascript
// BAD
let color = $derived(themeService.getColor('primary'))

// GOOD
let color = $state('')
$effect(() => {
  color = themeService.getColor('primary')
})
```

### ❌ Modification in $effect

```javascript
// BAD - INFINITE LOOP
let count = $state(0)
$effect(() => {
  count = count + 1
})

// GOOD - React to external change
let count = $state(0)
let externalValue = $state(0)
$effect(() => {
  count = externalValue * 2
})
```

### ❌ $derived with async

```javascript
// BAD
let data = $derived(await fetchData())

// GOOD
let data = $state(null)
$effect(() => {
  fetchData().then(result => data = result)
})
```

## Debugging

**$inspect** to debug reactivity:

```javascript
let count = $state(0)
$inspect(count)  // Automatic log on each change
```

## Summary Decision Tree

```
Need reactivity?
├─ Pure computation with DIRECT dependencies?
│  └─ ✅ $derived
│
└─ INDIRECT dependency or side effect?
   └─ ✅ $effect + $state
```

**DIRECT dependency:** `count * 2`, `firstName + lastName`, `items.length`
**INDIRECT dependency:** `service.get()`, `obj.method()`, API calls, subscriptions
