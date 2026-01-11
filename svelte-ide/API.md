# SIDE Public API

**SIDE** (Svelte-IDE) - Svelte 5 IDE Framework

## Single Entry Point

```javascript
import { ... } from '@svelte-ide/core'
```

## Public Exports

### Components

**SideAppShell (draft)**
```javascript
import { SideAppShell } from '@svelte-ide/core'
```
Post-auth application shell. Composes the IDE chrome and renders the capability host.

Draft props:
- `capabilities`: array of capability definitions passed to SideContainer
- `chrome`: configuration for title bar, toolbars, sidebars, status bar
- `overlays`: configuration for modals, context menu, toasts
- `layout`: configuration for panel sizing, visibility, persistence

**SideContainer**
```javascript
import { SideContainer } from '@svelte-ide/core'
```
Main framework component. Accepts a `capabilities` prop.

### Services

**eventBus**
```javascript
import { eventBus } from '@svelte-ide/core'

eventBus.publish('event:name', data)
eventBus.subscribe('event:name', callback)
```

**themeService**
```javascript
import { themeService } from '@svelte-ide/core'

themeService.getColor('primary')
themeService.getShadow('md')
themeService.getSpacing('lg')
themeService.setTheme({ colors: { primary: '#ff0000' } })
```

**i18nService**
```javascript
import { i18nService } from '@svelte-ide/core'

i18nService.t('key')
i18nService.setLocale('fr')
i18nService.registerTranslations('fr', { 'key': 'value' })
```

### Stores

**sideStore**
```javascript
import { sideStore } from '@svelte-ide/core'

sideStore.capabilities
sideStore.activeCapability
sideStore.registerCapability(capability)
sideStore.setActiveCapability(capabilityId)
```

## Restrictions

❌ Impossible to import internal modules:
```javascript
import { Internal } from '@svelte-ide/core/internal'  // ERROR
import { Helper } from '@svelte-ide/utils/Helper'     // ERROR
```

✅ Only the main entry point is accessible:
```javascript
import { ... } from '@svelte-ide/core'  // OK
```
