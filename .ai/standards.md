# Code Standards

## Svelte 5

### Components

- **< 150 lines** - Pure views receiving props
- **camelCase** for variables
- **No comments** - self-documenting code
- **No try/catch** except upon explicit request

### Reactivity

**$state - Local state:**
```javascript
let count = $state(0)
let items = $state([])
```

**$derived - Pure computations with DIRECT dependencies:**
```javascript
let doubled = $derived(count * 2)
let total = $derived(items.reduce((a, b) => a + b, 0))
```

**$effect - INDIRECT dependencies or side effects:**
```javascript
let result = $state(0)
$effect(() => {
  result = service.getValue()
})

$effect(() => {
  const unsub = eventBus.subscribe('event', handler)
  return () => unsub()  // Mandatory cleanup
})
```

## Technology Stack

**Framework:**
- Svelte 5 (Runes API)
- Vite 7+
- npm workspaces

**Persistence:**
- IndexedDB + AES-256-GCM encryption
- Web Crypto API

**Core Services:**
- eventBus - Pub/sub messaging
- themeService - Global theme management
- i18nService - Multilingual translations
- sideStore - Framework global state
- (More to come)

## Glossary

- **SIDE:** Svelte-IDE framework (acronym)
- **Tool:** Pluggable SIDE module
- **Integrator:** Developer using @svelte-ide/core
- **Core:** Framework services (eventBus, theme, i18n, etc.)
- **GeT:** GenericElementTree
