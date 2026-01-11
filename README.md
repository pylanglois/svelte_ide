# SIDE

**Svelte-IDE** - Enterprise-grade Svelte 5 IDE framework

npm package: `@svelte-ide/core`

**📖 AI Instructions:** [AI_INSTRUCTIONS.md](./AI_INSTRUCTIONS.md) (compatible with Claude Code, GitHub Copilot, Cursor, Windsurf)
**✏️ Edit instructions:** See [.ai/README.md](./.ai/README.md) to modify modules

## Structure

```
svelte-ide/
├── svelte-ide/              # Core framework
│   ├── core/               # Services (eventBus, theme, i18n)
│   ├── stores/             # State management
│   ├── components/         # UI components
│   └── index.js            # Public API
│
└── explorer/            # Example integrator
    ├── src/
    │   ├── capabilities/   # Custom capabilities
    │   └── App.svelte
    └── main.js
```

## Getting Started

**Installation (at root):**
```bash
npm install
```
→ Installs dependencies for all workspaces (svelte-ide + explorer)

**Run the MVP:**
```bash
npm run dev
```

**Or manually:**
```bash
cd explorer
npm run dev
```

## Creating a Capability

A capability = 3 elements:

**1. `index.svelte.js`**
```javascript
import MyPanel from './MyPanel.svelte'

export default {
  id: 'my-capability',
  name: 'My Capability',
  component: MyPanel
}
```

**2. `MyPanel.svelte`**
```svelte
<script>
import { themeService, i18nService } from '@svelte-ide/core'
</script>

<div style:--primary={themeService.getColor('primary')}>
  {i18nService.t('my-capability.title')}
</div>
```

**3. `translations.js`**
```javascript
export const translations = {
  fr: { 'my-capability.title': 'Ma Capability' },
  en: { 'my-capability.title': 'My Capability' }
}
```

## Svelte 5 Code Validation

**BEFORE coding:** Consult `_GUIDES/SVELTE5_PATTERNS.md`

**Validations:**
```bash
npm run check      # Check for forbidden legacy syntax
npm run lint       # ESLint
npm run validate   # Both
```

**Mandatory checklist:**
- No `export let`, `$:`, `on:event`
- `$derived` = pure computations only
- `$effect` doesn't modify what it observes
- `$effect` with cleanup if necessary

## Public API

**npm package:** `@svelte-ide/core`
**GitHub:** https://github.com/svelte-ide/svelte-ide

```javascript
import {
  SideContainer,
  sideStore,
  eventBus,
  themeService,
  i18nService
} from '@svelte-ide/core'
```

**Strict encapsulation:** Impossible to access framework internal modules. Only the public API exported in `svelte-ide/index.js` is accessible.

See `svelte-ide/API.md` for complete documentation.
