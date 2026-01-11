# Instructions IA - SIDE

> Compatible: Claude Code, GitHub Copilot, Cursor, Windsurf
> **Généré automatiquement depuis `.ai/`** - Ne pas éditer directement

**SIDE (Svelte-IDE)** - Framework IDE Svelte 5 de qualité entreprise


# Interaction Rules

> MANDATORY rules for all sessions

## Response Style

- **Brief and targeted responses by default.** Get straight to the point. Provide only the information necessary to unblock the user.
- **Add details or extended context only upon explicit request.** For example, if the user writes "explain", "elaborate", "more details", etc.
- **When the user asks a question, respond first, then wait before coding.**
  - First answer the question (concept, architecture choice, clarification).
  - Only propose code (new file, refactor, etc.) after explicit user validation.
- **Respond in professional international English.** Use precise and professional vocabulary.

## Forbidden Initiatives (WITHOUT EXPLICIT REQUEST)

- Do **not** create documentation (README, detailed comments, ADR, etc.) on your own initiative.
- **NO COMMENTS IN CODE.** It must be clean, well-named, and self-explanatory.
- Never **run** tests (unit, integration, end-to-end, etc.). Tests are executed by the user.
- Do **not develop** unit or integration tests if the user has not explicitly requested them.
- Never **develop** backwards compatibility code. All code must be aligned with the latest design version.

## Builds and Scripts

- You can run builds or compilation commands to verify that the project builds/compiles correctly.
- If the build fails, summarize the error concisely and propose a minimal fix.
- You can create utility and disposable scripts to speed up your work; you must delete them after use.

## General Style

- Avoid chatter and superfluous politeness.
- No long introductions or conclusions: start directly with the useful part of the response.
- Your interventions must be concise and easy to read. Use bullet points and lists to synthesize.

---

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

---

# SIDE Architecture

## Mission

**SIDE** (Svelte-IDE) - Modular and extensible IDE framework based on Svelte 5 Runes.

npm package: `@svelte-ide/core`

### Objectives

- Robust and maintainable architecture
- Clear and documented public API
- Maximum extensibility without compromising stability
- Strict core/tools separation
- Reusable and consistent patterns

## Project Structure

```
svelte-ide/
├── svelte-ide/                 # Core framework (@svelte-ide/core)
│   ├── core/                   # Services (eventBus, theme, i18n)
│   ├── stores/                 # State management (sideStore)
│   ├── components/             # UI components (SideContainer)
│   └── index.js                # Public API (single entry point)
│
├── explorer/                # Example/test integrator
│   ├── src/
│   │   ├── tools/             # Custom tools
│   │   └── App.svelte
│   └── main.js
│
└── _GUIDES/                    # Documentation
    ├── VISION.md               # Vision and objectives
    └── SVELTE5_PATTERNS.md     # ⚠️ Svelte 5 patterns
```

## Framework Public API

**Package:** `@svelte-ide/core`
**Repository:** https://github.com/svelte-ide/svelte-ide
**Strict encapsulation:** Single entry point

```javascript
import {
  SideContainer,      // Main component
  sideStore,          // Global state
  eventBus,           // Pub/sub messaging
  themeService,       // Theme management
  i18nService         // Translations
} from '@svelte-ide/core'
```

**FORBIDDEN:** Importing internal modules
```javascript
import { Internal } from '@svelte-ide/core/internal'  // ❌ BLOCKED
```

See `svelte-ide/API.md` for complete details.

## Commands

**Installation:**
```bash
npm install                    # At root (workspaces)
```

**Development:**
```bash
npm run dev                    # Run explorer
npm run dev:side              # Dev framework only
```

**Validation:**
```bash
npm run check                  # Check for forbidden legacy syntax
npm run lint                   # ESLint
npm run validate               # check + lint
```

**Build:**
```bash
npm run build                  # Build explorer
npm run build:side            # Build framework
```

## Reference Documentation

- `_GUIDES/VISION.md` - Vision and target architecture
- `_GUIDES/SVELTE5_PATTERNS.md` - ⚠️ Svelte 5 patterns (CONSULT BEFORE CODING)
- `svelte-ide/API.md` - Framework public API
- `README.md` - Quick start

---

# Backend Standards (Python)

> Standards for integrators developing Python backends with SIDE

## Python Norms

**Version and Style:**
- Python 3.13+ required
- PEP8 and pragmatic static typing (PEP484)
- snake_case for variables and functions
- Autonomous and testable modules

**Self-Documenting Code:**
- No `#` comments
- No docstrings
- Explicit names (functions, variables, parameters)
- Short and readable code

**Error Handling:**
- No try/except unless upon explicit request
- Try/except only for critical cases (external calls, I/O)
- Explicit business exceptions

**Organization:**
- No business logic in `__init__.py`
- File > 100 lines without justification? Split it
- Prefer pure functions to classes
- Create class only if state or external integration justifies it

## Recommended Architecture

**Stateless:**
- Backend stateless regarding business data
- No server persistence (data in frontend IndexedDB)
- Temporary sessions in memory if necessary

**Separation of Concerns:**
```
backend/
├── api/          # HTTP interface (FastAPI)
│   ├── routes/   # Endpoints
│   ├── security/ # Auth
│   └── config.py # Configuration
└── domain/       # Business logic and services
    ├── models/   # Pydantic models
    └── services/ # Business services
```

## Recommended Stack

**Framework:**
- FastAPI + Uvicorn (async server)
- Pydantic (validation and schemas)
- httpx (async HTTP calls)

**Build System:**
- uv + Hatch workspaces
- Minimal pyproject.toml

**Configuration:**
- Environment variables via config.py
- Pydantic Settings for validation

## Principles

**Dependency Injection:**
```python
from functools import lru_cache
from fastapi import Depends

@lru_cache(maxsize=None)
def get_service() -> MyService:
    return MyService()

@app.get("/data")
def endpoint(service: MyService = Depends(get_service)):
    return service.get_data()
```

**No Try/Except:**
```python
def process_data(data: dict) -> Result:
    return transform(data)
```

**Pure Functions:**
```python
def calculate_score(items: list[Item]) -> float:
    return sum(item.value for item in items) / len(items)
```

## Testing

Manual testing only (cURL, HTTP clients). No coded tests by AI without explicit request.

## Simplicity Checklist

1. Pure function sufficient? Don't create class
2. Direct library call possible? Don't wrap unnecessarily
3. File > 100 lines? Split by responsibility
4. Superfluous state/class? Remove
5. Complex abstraction? Verify if necessary

---

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

---

# Simplicity Checklists

> Verifications before finalizing code

## Backend Checklist (Python)

Before finalizing Python code, verify:

1. **Pure function sufficient?**
   - Don't create class if a pure function does the job
   - Class justified only if state or external integration

2. **Direct library call possible?**
   - Don't wrap unnecessarily
   - Use library directly if possible

3. **File > 100 lines without justification?**
   - Split by responsibility
   - One file = one clear responsibility

4. **Superfluous state/class?**
   - Remove dead code
   - Avoid unnecessary abstractions

5. **Complex abstraction?**
   - Verify if necessary
   - Prefer simple and direct to abstract and flexible

## Frontend Checklist (Svelte 5)

Before finalizing Svelte code, verify:

1. **Component < 150 lines?**
   - Otherwise split into sub-components
   - One component = one responsibility

2. **$derived possible or $effect necessary?**
   - $derived = DIRECT dependencies and pure computations
   - $effect = INDIRECT dependencies or side effects

3. **No infinite loop?**
   - NEVER read AND modify the same variable in $effect
   - Use guards if necessary

4. **Explicit variable names?**
   - Self-documenting code
   - No comments necessary

5. **Necessary abstraction or over-engineering?**
   - Avoid complexity creep
   - Simple > Prematurely flexible

## General Checklist

For all code (backend or frontend):

1. **No comments?**
   - Code must speak for itself
   - Explicit names suffice

2. **Try/catch justified?**
   - Only critical cases
   - Explicit business exceptions

3. **Manual tests planned?**
   - AI doesn't generate automated tests
   - User tests manually

4. **Dead code removed?**
   - No commented code
   - No unused functions

5. **Svelte 5 validation passed?**
   - `npm run validate` without errors
   - No legacy syntax

---

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
