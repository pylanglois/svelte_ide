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
