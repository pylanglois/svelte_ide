# Application Boot Sequence Analysis

## Executive Summary

The three projects use different initialization approaches reflecting their relative complexity:

- **Legacy (svelte_ide):** Complete bootstrap sequence in App.svelte with exhaustive state management
- **BNR-CVD:** Simplified sequence with delegation to legacy App + backend health management
- **SAI KAIKA:** Minimal sequence, maximum delegation to legacy

All projects follow the core pattern: `logging → security → mount → persistence → auth → tools → layout`

---

## 1. LEGACY (`svelte_ide/`)

### Entry Point: `main.js`

**Execution order (synchronous):**

```javascript
// 1. LOGGING SETUP (FIRST)
import '@svelte-ide/lib/setupLogging.js'

// 2. CSP SECURITY
applyCsp()

// 3. PRE-MOUNT REGISTRATIONS (DEV mode only)
// - Load devExternalTools
// - Create ConsoleTool + NotificationsTool
// - Register menus (help, quick-run, backup)
// - Register statusBar items

// 4. ROOT COMPONENT MOUNT
const app = mount(App, {
  target: document.getElementById('app'),
  props: { externalTools, systemTools, statusMessages, branding }
})
```

### App.svelte: Asynchronous Initialization Sequence (IIFE)

**Blocking steps order:**

```javascript
(async () => {
  // STEP 1: Persistence Initialization (parallel)
  await indexedDBService.initialize(['default', 'tools', 'layout', 'preferences'])
  await binaryStorageService.initialize()

  // STEP 1.5: Request Storage Persistence API
  await storagePersistenceService.requestPersistence()

  // STEP 2: Auth Initialization
  await authStore.initialize()

  // STEP 3: Wait for persistence:ready event
  await waitForPersistenceReady()

  // STEP 4: Register System Tools
  await registerSystemTools()

  // STEP 5: Register External Tools
  await toolManager.registerExternalTools(externalTools)

  // STEP 6: Restore User Layout
  await ensureUserLayoutRestored()
})()
```

### Critical Dependencies

```
IndexedDB.initialize()
    ↓
authStore.initialize() → AuthManager.initializeProviders()
    ↓
$effect: authStore.encryptionKey change
    ↓
IndexedDBService.setEncryptionKey()
    ↓
IndexedDBService.readyForEncryption() (Promise resolve)
    ↓
eventBus.publish('persistence:ready')
    ↓
[Tools wait for persistence:ready to hydrate their data]
    ↓
toolManager.registerExternalTools()
    ↓
ideStore.restoreUserLayout()
```

### Boot Events

**Emitted:**
- `persistence:ready` - When encryption key is synchronized (10s timeout)
- `persistence:error` - On timeout or initialization error

**Listened:**
- `persistence:ready` - By ideStore, tools, and components requiring storage

### Error Handling

```javascript
// If IndexedDB fails: continue without persistence (degraded mode)
catch (idbError) {
  appLogger.warn('Persistence initialization failed, data persistence may be limited')
  // ✅ DOES NOT BLOCK the application
}

// If encryption key timeout: continue anyway
catch (readyError) {
  appLogger.warn('IndexedDB readiness timeout, publishing persistence:ready anyway')
  eventBus.publish('persistence:error', { reason: 'timeout' })
  // ✅ Publishes persistence:ready even on timeout
}
```

### Constants

```javascript
PERSISTENCE_READY_TIMEOUT_MS = 10000  // 10 seconds
```

---

## 2. BNR-CVD (`ul-eia-poc-bnr-cv-chercheur/frontend/`)

### Entry Point: `main.js`

**Execution order (synchronous):**

```javascript
// 1. SECURITY (DEV only)
if (import.meta.env.DEV) {
  applyCsp()
}

// 2. SECURITY CONFIGURATION
const securityConfig = getTokenSecurityConfig()

// 3. PRE-MOUNT REGISTRATIONS
statusBarService.registerItem(...) // 4 items
mainMenuService.registerMenu(...) // 2 actions (CV, Report)

// 4. START BACKEND HEARTBEAT
startBackendHeartbeat({ healthUrl })

// 5. MOUNT ROOT COMPONENT
const app = mount(App, {
  target: document.getElementById('app'),
  props: { systemTools, statusMessages }
})
```

### App.svelte: Delegation + Admin Logic

**Architecture:**

```javascript
// FULL DELEGATION to legacy App
<IDEApp {externalTools} {systemTools} {statusMessages} {branding} />

// SPECIFIC LOGIC: Dynamic Admin Panel
$effect(() => {
  // React to authStore.isAuthenticated
  void ensureAdminTool()
})

async function ensureAdminTool() {
  // 1. Check auth
  if (!isAuthed || !key) return

  // 2. Wait for backend online
  const backendOk = await ensureBackendReady(15000)

  // 3. Check admin status
  const status = await adminService.getStatus()

  // 4. Register tool if admin
  if (status?.is_admin) {
    adminPanelTool.register(toolManager)
    await ideStore.restoreUserLayout?.(user)
  }
}
```

### Critical Dependencies

```
Backend Heartbeat (starts immediately, non-blocking)
    ↓
Legacy IDEApp bootstrap (same sequence as legacy)
    ↓
authStore.isAuthenticated ($effect)
    ↓
waitForBackendOnline({ timeout: 15s })
    ↓
adminService.getStatus() (API call)
    ↓
[If admin] adminPanelTool.register()
```

### Boot Events

**Backend Health:**
- `backendHealthState.status: 'idle' → 'checking' → 'online'|'offline'`
- Heartbeat every 60s, retry every 5s if offline

**Inherited from legacy:**
- All `persistence:ready` events, etc.

### Error Handling

```javascript
// Admin panel: silent failure
catch (error) {
  console.warn('Admin panel hidden: admin status check failed', error)
  // ✅ Continue without admin panel
}

// Backend timeout: reconnection modal
if (!backendOk) {
  // BackendReconnectModal displays automatically
  return null
}
```

### Constants

```javascript
BACKEND_READY_TIMEOUT = 15000    // 15 seconds
HEARTBEAT_WAKE_INTERVAL = 60000  // 60 seconds
HEARTBEAT_RETRY_INTERVAL = 5000  // 5 seconds
```

---

## 3. SAI KAIKA (`ul-eia-adm-admission/sai_kaika/frontend/side-viewer/`)

### Entry Point: `main.js`

**Execution order (synchronous):**

```javascript
// 1. MONACO WORKERS (top-level, synchronous)
self.MonacoEnvironment = {
  getWorker(_, label) {
    if (label === 'json') return new jsonWorker()
    return new editorWorker()
  }
}

// 2. LOGGER
const logger = createLogger('side-viewer/main')

// 3. SECURITY (DEV)
if (import.meta.env.DEV) {
  applyCsp()
}

// 4. PRE-MOUNT REGISTRATIONS
statusBarService.registerItem(...) // 4 items (custom OCR counter)

// 5. MOUNT
const app = mount(App, {
  target: document.getElementById('app'),
  props: { systemTools, statusMessages }
})
```

### App.svelte: Pure Delegation

**Minimalist architecture:**

```javascript
// 100% DELEGATION to legacy App
<IDEApp {externalTools} {systemTools} {statusMessages} {branding} />

// externalTools = [candidateLibraryTool]
// ✅ No custom bootstrap logic
```

### Critical Dependencies

```
Monaco Workers (synchronous, global)
    ↓
Legacy IDEApp bootstrap (same sequence as legacy)
    ↓
candidateLibraryTool.register()
    → CandidateLibraryTool (topLeft)
    → ComplianceTool (bottomRight)
```

### Boot Events

**100% inherited from legacy:**
- `persistence:ready`
- No custom events

### Error Handling

Delegated to legacy, no specific logic.

---

## Common Patterns

### 1. Universal Sequence (inherited from legacy)

```
setupLogging → applyCsp → mount(App) → IndexedDB.init → Auth.init → persistence:ready
```

### 2. Async vs Sync

**Synchronous (blocks initial render):**
- `setupLogging.js`
- `applyCsp()`
- statusBar/menu registrations (main.js)
- Monaco workers (SAI KAIKA)

**Asynchronous (non-blocking):**
- `IndexedDB.initialize()`
- `authStore.initialize()`
- `toolManager.registerExternalTools()`
- Backend heartbeat (BNR-CVD)

### 3. Standard Timeouts

```javascript
PERSISTENCE_READY_TIMEOUT_MS = 10000  // 10s
Backend health timeout = 15000         // 15s
Heartbeat wake interval = 60000        // 60s
Heartbeat retry interval = 5000        // 5s
```

### 4. Degradation Strategy

**All projects:**
- Continue without persistence if IndexedDB fails
- Continue without admin panel if backend offline (BNR-CVD)
- Publish `persistence:ready` even on timeout

---

## Key Differences

| Aspect | Legacy | BNR-CVD | SAI KAIKA |
|--------|---------|---------|-----------|
| **App.svelte size** | 492 lines | 169 lines | 25 lines |
| **Custom bootstrap** | Full (IIFE) | Partial (admin logic) | None (delegation) |
| **Backend check** | ❌ No | ✅ Yes (heartbeat) | ❌ No |
| **Dynamic tools** | ❌ No | ✅ Yes (admin panel) | ❌ No |
| **Monaco Workers** | ❌ No | ❌ No | ✅ Yes (global) |
| **Custom status bar** | Standard | +Backend badge | +OCR counter |

---

## Concrete Examples

### Typical Sequence (BNR-CVD, admin user)

```
T+0ms:    main.js: applyCsp()
T+1ms:    main.js: startBackendHeartbeat()
T+2ms:    mount(App)
T+5ms:    IDEApp → App.svelte (legacy)
T+10ms:   IndexedDB.initialize() start
T+50ms:   IndexedDB ready
T+51ms:   authStore.initialize() start
T+100ms:  OAuth callback detected
T+500ms:  Auth providers initialized
T+501ms:  User authenticated, encryption key derived
T+502ms:  IndexedDBService.setEncryptionKey()
T+503ms:  IndexedDBService.readyForEncryption() resolves
T+504ms:  eventBus.publish('persistence:ready')
T+505ms:  registerSystemTools() (ConsoleTool)
T+506ms:  registerExternalTools() start
T+510ms:    → documentLibraryTool.register()
T+511ms:    → assistantTool.register()
T+512ms:    → adminPanelToolLoader() start
T+550ms:      → waitForBackendOnline() start
T+600ms:      → Backend heartbeat: status='online'
T+601ms:      → adminService.getStatus() → { is_admin: true }
T+602ms:      → adminPanelTool.register()
T+603ms:  registerExternalTools() complete
T+604ms:  ideStore.restoreUserLayout(user)
T+800ms:  Layout restored, panels hydrated
T+801ms:  ideStore.setStatusMessage('IDE ready')
```

### Simplified Sequence (SAI KAIKA)

```
T+0ms:    main.js: MonacoEnvironment setup (synchronous)
T+1ms:    mount(App)
T+2ms:    IDEApp → App.svelte (legacy)
T+10ms:   IndexedDB.initialize()
T+50ms:   authStore.initialize()
T+500ms:  persistence:ready
T+505ms:  registerExternalTools([candidateLibraryTool])
T+510ms:    → CandidateLibraryTool.register()
T+511ms:    → ComplianceTool.register()
T+520ms:  ideStore.restoreUserLayout()
T+600ms:  IDE ready
```

---

## Critical Issues for SIDE Framework

### 1. Too Rigid Sequence

The legacy enforces strict order: persistence → auth → tools → layout. Integrators cannot modify this order.

**Example:** An integrator wanting to show a splash screen during auth initialization has no hook to insert custom UI.

### 2. No Lifecycle Hooks

No way for integrators to insert logic between steps (e.g., "after auth, before tools").

**Example:** BNR-CVD must implement `$effect` workaround to conditionally register admin panel after auth.

### 3. Non-Standardized Backend Checks

BNR-CVD has its own heartbeat system. Should be in core framework.

**Example:** Every project needing backend health monitoring reinvents the wheel.

### 4. Complex Dynamic Tools

BNR-CVD manually manages conditional admin panel registration. Pattern undocumented.

**Example:**
```javascript
// Manual logic required
$effect(() => {
  void ensureAdminTool()
})

async function ensureAdminTool() {
  if (!isAuthed) return
  const backendOk = await ensureBackendReady(15000)
  if (!backendOk) return
  const status = await adminService.getStatus()
  if (!status?.is_admin) return
  adminPanelTool.register(toolManager)
}
```

Should be:
```javascript
// Declarative
const adminTool = {
  id: 'admin-panel',
  condition: async (context) => {
    const status = await context.backend.get('/admin/status')
    return status.is_admin
  },
  component: AdminPanel
}
```

### 5. Ad-hoc Monaco Workers

SAI KAIKA configures Monaco globally in main.js. Should be encapsulated.

**Example:**
```javascript
// Currently: global side-effect in main.js
self.MonacoEnvironment = { getWorker(...) { ... } }

// Should be: framework-provided service
import { monacoService } from '@svelte-ide/monaco'
monacoService.initialize()
```

### 6. Limited Boot Events

Only `persistence:ready` exists. Missing: `auth:ready`, `tools:ready`, `layout:ready`, `app:ready`.

**Example:** Integrators wanting to show loading progress cannot track granular steps.

### 7. Non-Configurable Timeouts

Hard-coded in App.svelte. Integrators cannot adjust for their network conditions.

**Example:**
```javascript
// Legacy: hard-coded
const PERSISTENCE_READY_TIMEOUT_MS = 10000

// Should be: configurable
bootSequence({
  timeouts: {
    persistence: 20000,  // Slower network
    auth: 30000,         // OAuth redirects
    backend: 15000
  }
})
```

---

## Framework Gaps Identified

### Gap #1: No Bootstrap Configuration API

**Need:** Declarative boot sequence configuration with hooks.

**Current workaround:** Integrators override App.svelte or use $effect hacks.

**What SIDE should provide:**
```javascript
const app = await bootSequence({
  phases: {
    security: { csp: true },
    persistence: {
      timeout: 10000,
      stores: ['default', 'tools', 'layout'],
      onError: 'continue'  // or 'halt'
    },
    auth: {
      providers: ['azure', 'google'],
      timeout: 30000
    },
    tools: {
      system: [ConsoleTool],
      external: [myTool],
      conditional: [
        {
          tool: adminPanelTool,
          condition: async (ctx) => {
            const status = await ctx.backend.get('/admin/status')
            return status.is_admin
          }
        }
      ]
    },
    layout: { restore: true }
  },
  hooks: {
    afterAuth: async (context) => {
      console.log('Auth complete', context.user)
    },
    beforeLayout: async (context) => {
      await migrateOldData(context.user)
    }
  }
})
```

### Gap #2: No Granular Boot Events

**Need:** Track boot progress for loading indicators.

**Current workaround:** Listen to single `persistence:ready` event.

**What SIDE should provide:**
```javascript
bootSequence.on('phase:start', ({ phase }) => {
  loadingIndicator.show(`Initializing ${phase}...`)
})

bootSequence.on('phase:complete', ({ phase, duration }) => {
  console.log(`${phase} ready in ${duration}ms`)
})

bootSequence.on('boot:progress', ({ current, total, phase }) => {
  progressBar.update(current / total)
})

bootSequence.on('boot:complete', ({ app, duration }) => {
  loadingIndicator.hide()
  console.log(`App ready in ${duration}ms`)
})
```

### Gap #3: No Backend Health Service

**Need:** Standard backend connectivity monitoring.

**Current workaround:** BNR-CVD implements custom heartbeat service.

**What SIDE should provide:**
```javascript
import { backendHealth } from '@svelte-ide/core'

await backendHealth.configure({
  url: '/api/health',
  interval: 60000,
  retryInterval: 5000,
  timeout: 5000
})

backendHealth.on('online', () => {
  statusBar.show('Connected')
})

backendHealth.on('offline', () => {
  modal.show(ReconnectModal)
})

const isOnline = backendHealth.status  // reactive
```

### Gap #4: No Tool Registration Lifecycle

**Need:** Hooks for tool initialization (async setup, conditional registration).

**Current workaround:** Manual $effect logic in App.svelte.

**What SIDE should provide:**
```javascript
const myTool = {
  id: 'my-tool',
  component: MyPanel,

  // Lifecycle hooks
  async beforeRegister(context) {
    // Load configuration
    this.config = await context.storage.get('my-tool:config')
  },

  async afterRegister(context) {
    // Subscribe to events
    context.eventBus.subscribe('document:open', this.handleOpen)
  },

  async beforeUnregister(context) {
    // Cleanup
    context.eventBus.unsubscribe('document:open', this.handleOpen)
  }
}
```

### Gap #5: No Monaco Integration

**Need:** Official Monaco Editor wrapper with lifecycle management.

**Current workaround:** SAI KAIKA manually configures workers in main.js.

**What SIDE should provide:**
```javascript
import { monacoService } from '@svelte-ide/monaco'

await bootSequence({
  monaco: {
    workers: ['json', 'typescript', 'html'],
    theme: 'vs-dark'
  }
})

// Later in tool
const model = monacoService.createModel(documentId, content, 'typescript')
```

---

## Recommendations for SIDE

### 1. Declarative Boot API

Provide `bootSequence()` function with phases, hooks, and events.

**Benefits:**
- Clear, documented initialization order
- Extensibility without hacks
- Standard patterns for common needs (backend health, conditional tools)
- Progress tracking for UX

### 2. Standard Services

Bundle common services:
- `backendHealth` - Connectivity monitoring
- `monacoService` - Monaco Editor integration (optional package)
- `migrationService` - Data migration between versions

### 3. Conditional Tools API

First-class support for tools that register based on runtime conditions (user role, backend status, feature flags).

### 4. Boot Events Catalog

Document standard events:
- `phase:start`, `phase:complete`
- `persistence:ready`, `auth:ready`, `tools:ready`, `layout:ready`
- `boot:progress`, `boot:complete`, `boot:error`

### 5. Error Recovery Strategies

Configurable behavior on boot failures:
- `halt` - Stop boot and show error
- `continue` - Log warning and continue
- `retry` - Retry with exponential backoff
- `fallback` - Use degraded mode

### 6. Development Tools

Provide boot performance profiler:
```javascript
if (import.meta.env.DEV) {
  bootSequence.enableProfiler()
  // Logs detailed timing for each phase
}
```

---

## Key Files Referenced

**Legacy:**
- `/svelte_ide/src/main.js` (88 lines)
- `/svelte_ide/src/App.svelte` (492 lines)
- `/svelte_ide/src/stores/authStore.svelte.js`
- `/svelte_ide/src/core/persistence/IndexedDBService.svelte.js`
- `/svelte_ide/src/core/ToolManager.svelte.js`

**BNR-CVD:**
- `/ul-eia-poc-bnr-cv-chercheur/frontend/src/main.js` (154 lines)
- `/ul-eia-poc-bnr-cv-chercheur/frontend/src/App.svelte` (169 lines)
- `/ul-eia-poc-bnr-cv-chercheur/frontend/src/services/backendHealthService.js`

**SAI KAIKA:**
- `/ul-eia-adm-admission/sai_kaika/frontend/side-viewer/src/main.js` (113 lines)
- `/ul-eia-adm-admission/sai_kaika/frontend/side-viewer/src/App.svelte` (25 lines)

---

## Conclusion

All three projects follow the same core boot sequence inherited from the legacy framework:

**logging → security → mount → persistence → auth → tools → layout**

However, this sequence is **too rigid** with **no extensibility** beyond the legacy App.svelte IIFE.

**5 major gaps identified:**
1. No declarative boot configuration API
2. No granular boot events for progress tracking
3. No standard backend health service
4. No tool registration lifecycle hooks
5. No Monaco Editor integration

The new SIDE framework should provide a **declarative `bootSequence()` API** with phases, hooks, and events to enable integrators to customize initialization without forking or hacking.
