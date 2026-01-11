# Framework Services Usage Analysis - Legacy svelte-ide in Integration Projects

## Executive Summary

Both projects use the **legacy framework** (branch `dreamer` for BNR-CVD, branch `main/fork` for SAI KAIKA), which exposes approximately **30 core services** via `svelte-ide`. Real-world usage concentrates on **10-12 critical services** used intensively, with consistent usage patterns across both projects.

---

## Project 1: BNR-CVD (Researcher CV Generation)

### Framework Used
- **Package**: `svelte-ide`: `github:svelte-ide/svelte_ide#dreamer`
- **33 files** use the framework (194 total occurrences)

### 1. Core Services Used (by frequency)

#### **Category A: Critical Services (intensive usage)**

**`persistenceRegistry`** - **Usage: Very frequent**
- `/tools/document-library/documentStore.js` - Document tree + blob storage
- `/tools/cv-assistant/services/promptHistory.js` - Prompt history
```javascript
const persister = persistenceRegistry.createPersister(STORAGE_NAMESPACE, 'binary')
await persister.saveBlob(hash, file)
const blob = await persister.loadBlob(hash)
```
**Pattern**: Content-addressable storage (SHA-256 hash), separation of JSON tree / binary blobs

**`eventBus`** - **Usage: Very frequent (22 occurrences)**
- Inter-tool communication
- Tab state synchronization
- Document change notifications
```javascript
eventBus.subscribe('document-library:file-updated', handleExternalUpdate)
eventBus.subscribe('persistence:ready', onReady)
eventBus.subscribe('tabs:activated', refreshContext)
eventBus.publish('document-library:open-document', meta)
```
**Pattern**: Decoupled pub/sub, domain:action named events

**`ideStore`** - **Usage: Very frequent (28 occurrences)**
- Tab management (addTab, closeTab, getTabById, setActiveTab)
- Layout restoration (restoreUserLayout, resetLayout)
- UI logs (addLog)
- Access activeTab / tabs
```javascript
ideStore.addTab(tab)
ideStore.setActiveTab(tabId)
const existing = ideStore.getTabById(tabId)
ideStore.closeTab(tabId)
await ideStore.restoreUserLayout(user)
```
**Pattern**: Central store, synchronous imperative API

**`createTab`** - **Usage: Frequent**
- Tab creation with descriptors for hydration
```javascript
const tab = createTab({
  id: tabId,
  title: documentName,
  component: ViewerComponent,
  icon: TOOL_ICON,
  scrollMode: SCROLL_MODES.tool,
  descriptor: {
    type: FILE_VIEWER_TAB_PREFIX,
    resourceId: tabId,
    params: { documentId, mimeType, editable },
    toolId: TOOL_ID
  },
  metadata: { documentId, language, editable }
})
```
**Pattern**: JSON descriptors for persistence/layout hydration

**`getAuthStore`** - **Usage: Frequent (10 occurrences)**
- Authentication + API token injection
- Session expiry handling
```javascript
const authStore = getAuthStore()
await authStore.initialize()
if (authStore.isAuthenticated) { ... }
const user = authStore.currentUser
authStore.handleSessionExpired({ message })
```
**Pattern**: Lazy init store, auth lifecycle management

**`Tool` (base class)** - **Usage: Mandatory (3 tools)**
- `/tools/document-library/index.svelte.js`
- `/tools/cv-assistant/index.svelte.js`
- `/tools/admin-panel/index.svelte.js`
```javascript
import { Tool } from 'svelte-ide'

export default new Tool({
  id: 'document-library',
  name: 'Bibliothèque',
  icon: '📚',
  side: 'left',
  orientation: 'north',
  order: 200,
  component: DocumentLibraryPanel
})
```
**Pattern**: Declarative, automatic registration via `externalTools` prop

**`modalService`** - **Usage: Frequent**
- Confirmation dialogs (delete, tab close)
```javascript
const result = await modalService.confirm({
  question: 'Delete this file?',
  description: fileName,
  buttons: [
    { id: 'cancel', label: 'Cancel' },
    { id: 'delete', label: 'Delete' }
  ]
})
if (result?.actionId === 'delete') { ... }
```

**`GenericElementTree`** - **Usage: Core UI component**
- Tree explorer with drag-drop, inline actions, context menu
```javascript
<GenericElementTree
  initialTree={tree}
  initialExpandedState={expandedState}
  onNodeSelect={handleSelect}
  onExpandedFoldersChange={handleExpansionChange}
  onTreeChange={handleTreeChange}
  onFilesSelected={handleFilesSelected}
  sortComparer={sortComparer}
  contextMenuBuilder={buildContextMenu}
  inlineActionsBuilder={buildInlineActions}
/>
```
**Pattern**: Controlled component, events vs props

#### **Category B: Infrastructure Services (moderate usage)**

**`statusBarService`** - **Usage: Moderate (main.js)**
- Custom status bar items
```javascript
statusBarService.registerItem('left', {
  id: 'status-message',
  component: StatusBarMessageItem,
  props: { fallback: 'Ready' },
  order: 0
}, OWNER_ID)
```

**`mainMenuService`** - **Usage: Moderate (main.js)**
- Main menu actions
```javascript
mainMenuService.registerMenu({
  id: 'cv-unified-generator',
  type: 'action',
  icon: 'Generate CV',
  title: 'Generate CV',
  order: 205,
  action: createUnifiedCvGenerationHandler(backendUrl)
}, OWNER_ID)
```

**`toolManager`** - **Usage: Moderate (App.svelte)**
- Dynamic tool registration (admin panel)
```javascript
const existing = toolManager.getTool(ADMIN_TOOL_ID)
if (status?.is_admin) {
  adminPanelTool.register(toolManager)
}
toolManager.unregisterTool(ADMIN_TOOL_ID)
```

#### **Category C: Specialized Services (rare usage)**

**`SCROLL_MODES`** - Tab scroll behavior constants
**`applyCsp`** - CSP headers dev mode
**`getTokenSecurityConfig`** - Token encryption config
**`ConsoleTool`** - System console tool

---

## Project 2: SAI KAIKA (Admission Assistant)

### Framework Used
- **Package**: `svelte-ide`: `github:pylanglois/svelte_ide#main`
- **14 files** use the framework (59 total occurrences)

### 1. Core Services Used (by frequency)

**Usage similar to BNR-CVD** with these differences:

#### **`createLogger`** - **Usage: Very frequent (8 occurrences)**
```javascript
const logger = createLogger('candidate-library/viewer-tabs')
logger.debug('openDocumentTab', { dossierId, fileName })
logger.warn('Listener failed', error)
```
**Pattern**: Namespaced loggers, not used in BNR-CVD

#### **`persistenceRegistry`** - **Usage: Multi-namespace cache**
```javascript
const NAMESPACES = {
  dossiers: 'ds:dossiers',
  files: 'ds:files',
  artifactsJson: 'ds:artifacts-json',
  pagesBlob: 'ds:pages-blob',
  preferences: 'ds:prefs'
}

async function getPersister(namespace, type) {
  const persister = persistenceRegistry.createPersister(namespace, type, { tenantId: 'saikaika' })
  return persister
}
```
**Pattern**: Multi-tenant, domain-separated namespaces

---

## Framework Gaps Identified (Both Projects Implement Locally)

### Gap #1: Contextual Tab Hydration System

**Need**: Tabs need to restore not just component and props, but also runtime context (scroll position, selections, editor state, view mode).

**BNR-CVD Implementation** (`viewerTabsService.js`):
```javascript
eventBus.subscribe('tab:hydrate', (event) => {
  const { descriptor, hydrateCallback } = event
  if (descriptor.type !== FILE_VIEWER_TAB_TYPE) return

  const viewer = getViewerById(descriptor.params.viewerId)
  const config = viewer.createTabConfig(descriptor.params)
  hydrateCallback(config.component, config.props)
})
```

**SAI KAIKA Implementation** (`viewer-tabs.js`):
```javascript
eventBus.subscribe('tab:hydrate', ({ descriptor, hydrateCallback }) => {
  if (!descriptor?.type?.startsWith('kaika:dossier-file:')) return

  const { dossierId, fileId, viewMode } = descriptor.params
  hydrateCallback(DocumentViewer, {
    dossierId,
    fileId,
    initialViewMode: viewMode
  })
})
```

**Why this is a gap**:
- Framework provides `createTab` with `descriptor` but hydration is manual
- Each integrator must listen to `tab:hydrate` event and implement restoration logic
- No standard pattern for persisting/restoring tab context beyond component + props
- Scroll position, selections, editor cursors lost on reload without custom code

**What SIDE should provide**:
- Declarative tab hydration API
- Built-in context persistence (scroll, selection, view state)
- Standard serialization/deserialization patterns
- Automatic hydration callback registration

---

### Gap #2: Content-Addressable Storage Pattern

**Need**: Store binary blobs (files, images) using content hash as key to avoid duplication and enable deduplication.

**BNR-CVD Implementation** (`documentStore.js`):
```javascript
import { createHash } from 'crypto-js-sha256'

async function calculateFileHash(file) {
  const arrayBuffer = await file.arrayBuffer()
  const wordArray = lib.WordArray.create(arrayBuffer)
  return createHash(wordArray).toString()
}

export async function saveFileBlob(file) {
  const hash = await calculateFileHash(file)
  await persister.saveBlob(hash, file)
  return hash
}

export async function loadDocumentContent(documentId) {
  const tree = await loadTree()
  const node = findNodeById(tree, documentId)
  const blob = await loadFileBlob(node.contentHash)
  return { blob, metadata }
}
```

**SAI KAIKA Implementation** (`data-store/files.js`):
```javascript
async function savePageBlob(dossierId, fileId, pageIndex, blob) {
  const key = `${dossierId}:${fileId}:${pageIndex}`
  const hash = await computeHash(blob)
  await blobPersister.saveBlob(hash, blob)
  await metaPersister.saveJson(key, { hash, timestamp: Date.now() })
  return hash
}

async function loadPageBlob(dossierId, fileId, pageIndex) {
  const key = `${dossierId}:${fileId}:${pageIndex}`
  const meta = await metaPersister.loadJson(key)
  if (!meta?.hash) return null
  return await blobPersister.loadBlob(meta.hash)
}
```

**Why this is a gap**:
- Both projects manually implement SHA-256 hashing
- Both maintain separate metadata (tree/key → hash) and blob storage (hash → blob)
- Pattern is reinvented in each project with subtle variations
- No guidance on hash algorithm choice, collision handling, or garbage collection

**What SIDE should provide**:
```javascript
const persister = persistenceRegistry.createPersister('docs', 'binary', {
  contentAddressable: true,
  hashAlgorithm: 'SHA-256'
})

const { hash } = await persister.saveBlob(file)
const blob = await persister.loadBlob(hash)
```

---

### Gap #3: HTTP Cache with Server Fingerprinting

**Need**: Cache API responses locally with invalidation based on server-side freshness checks (ETag, Last-Modified, custom fingerprints).

**BNR-CVD Implementation** (`services/cache.js`):
```javascript
async function getCachedOrFetch(key, fetchFn, revalidateFn) {
  const cached = await persister.loadJson(key)
  const meta = await persister.loadJson(`${key}:meta`)

  if (cached && meta) {
    const fresh = await revalidateFn(meta.etag)
    if (fresh) return cached
  }

  const { data, etag } = await fetchFn()
  await persister.saveJson(key, data)
  await persister.saveJson(`${key}:meta`, { etag, timestamp: Date.now() })
  return data
}
```

**SAI KAIKA Implementation** (`data-store/index.js`):
```javascript
async function getFiles(dossierId, { forceRefresh = false } = {}) {
  const cached = await loadJson(NAMESPACES.files, keys.files(dossierId))
  const cachedMeta = await loadFilesMeta(dossierId)

  if (cached && !forceRefresh) {
    const serverFingerprint = await fetchDossierFilesFingerprint(dossierId)
    if (serverFingerprint === cachedMeta?.fingerprint) {
      return cached
    }
  }

  const fresh = await fetchDossierFiles(dossierId)
  const fingerprint = await fetchDossierFilesFingerprint(dossierId)
  await saveJson(NAMESPACES.files, keys.files(dossierId), fresh)
  await saveFilesMeta(dossierId, { fingerprint, timestamp: Date.now() })
  return fresh
}
```

**Why this is a gap**:
- Both projects implement cache-first strategy with server revalidation
- Both use HEAD requests for lightweight freshness checks
- Both maintain metadata (etag/fingerprint) separately from cached data
- No framework primitives for stale-while-revalidate, conditional requests, or cache TTL

**What SIDE should provide**:
```javascript
const cache = cacheService.create('dossier-files', {
  strategy: 'stale-while-revalidate',
  revalidate: async (key, meta) => {
    const response = await fetch(`/api/dossiers/${key}/files`, { method: 'HEAD' })
    return {
      fresh: response.headers.get('ETag') === meta.etag,
      etag: response.headers.get('ETag')
    }
  }
})

const files = await cache.get(dossierId, () => fetchDossierFiles(dossierId))
```

---

### Gap #4: Cross-Tool State Reactivity

**Need**: Share reactive state between tools (selections, highlights, active document) without coupling tools directly.

**BNR-CVD Implementation** (`services/selectionStore.js`):
```javascript
const selections = new Map()
const subscribers = new Map()

export function setSelection(documentId, selection) {
  selections.set(documentId, selection)
  const subs = subscribers.get(documentId) || []
  subs.forEach(callback => callback(selection))
}

export function subscribeSelection(documentId, callback) {
  if (!subscribers.has(documentId)) {
    subscribers.set(documentId, [])
  }
  subscribers.get(documentId).push(callback)

  return () => {
    const subs = subscribers.get(documentId)
    const index = subs.indexOf(callback)
    if (index > -1) subs.splice(index, 1)
  }
}

export function getSelection(documentId) {
  return selections.get(documentId)
}
```

**SAI KAIKA Implementation** (`stores/FlatFileStore.js`):
```javascript
let dossiers = $state([])
let selectedFileId = $state(null)
const observers = []

export const FlatFileStore = {
  get dossiers() { return dossiers },
  get selectedFileId() { return selectedFileId },

  setSelectedFile(fileId) {
    selectedFileId = fileId
    notify()
  },

  subscribe(callback) {
    observers.push(callback)
    return () => {
      const index = observers.indexOf(callback)
      if (index > -1) observers.splice(index, 1)
    }
  }
}

function notify() {
  observers.forEach(cb => cb())
}
```

**Why this is a gap**:
- Both projects implement manual observer pattern for cross-tool reactivity
- Both maintain separate subscription lists and notification logic
- eventBus is one-way (publish/subscribe) - doesn't support reactive getters
- No bridge between Svelte 5 runes (`$state`, `$derived`) and framework stores

**What SIDE should provide**:
```javascript
const sharedState = stateSync.create({
  selectedDocument: null,
  textSelection: null,
  highlights: []
})

// Tool A
sharedState.selectedDocument = documentId

// Tool B (reactive)
$effect(() => {
  console.log('Selection changed:', sharedState.selectedDocument)
})
```

---

### Gap #5: Extensible Viewer/Handler Registry

**Need**: Register custom viewers/handlers for different file types and resolve which viewer to use based on file metadata (MIME type, extension, custom predicates).

**BNR-CVD Implementation** (`documentViewerRegistry.js`):
```javascript
const viewerRegistry = new Map()

export function registerViewer(viewer) {
  if (!viewer.id || !viewer.canOpen || !viewer.createTabConfig) {
    throw new Error('Invalid viewer')
  }
  viewerRegistry.set(viewer.id, viewer)
}

export function resolveViewer(fileMeta) {
  for (const viewer of viewerRegistry.values()) {
    if (viewer.canOpen(fileMeta)) {
      return viewer
    }
  }
  return null
}

// Usage
registerViewer({
  id: 'pdf-viewer',
  canOpen: (meta) => meta.mimeType === 'application/pdf',
  createTabConfig: (params) => ({
    component: PdfViewer,
    props: { documentId: params.documentId }
  })
})

const viewer = resolveViewer({ mimeType: 'application/pdf', name: 'doc.pdf' })
```

**SAI KAIKA Implementation** (`viewers/registry.js`):
```javascript
const viewers = []

export function registerFileViewer(viewer) {
  viewers.push(viewer)
}

export function getViewerForFile(fileMeta) {
  return viewers.find(v => v.accepts(fileMeta))
}

// Usage
registerFileViewer({
  id: 'image-viewer',
  accepts: (file) => file.mimeType?.startsWith('image/'),
  component: ImageViewer,
  priority: 10
})

const viewer = getViewerForFile({ mimeType: 'image/png', size: 1024 })
```

**Why this is a gap**:
- Both projects implement viewer resolution with predicate functions
- Both maintain registry of viewer configurations
- No framework support for file type → component mapping
- No standard priority/fallback mechanism for multiple matching viewers

**What SIDE should provide**:
```javascript
viewerRegistry.register({
  id: 'pdf-viewer',
  accepts: (file) => file.mimeType === 'application/pdf',
  component: PdfViewer,
  priority: 100
})

const viewer = viewerRegistry.resolve({ mimeType: 'application/pdf' })
const tab = await viewer.openFile(fileId)
```

---

## Comparative Synthesis

### Services Used in Both Projects (Core Framework)

| Service | BNR-CVD | SAI KAIKA | Primary Usage |
|---------|---------|-----------|---------------|
| `persistenceRegistry` | ✅ | ✅ | JSON + binary storage |
| `eventBus` | ✅ (22×) | ✅ (6×) | Inter-tool communication |
| `ideStore` | ✅ (28×) | ✅ (2×) | Tab/layout management |
| `createTab` | ✅ | ✅ | Tab creation |
| `getAuthStore` | ✅ (10×) | ✅ (2×) | Authentication |
| `Tool` | ✅ (3×) | ✅ (1×) | Tool base class |
| `modalService` | ✅ | ❌ | Dialogs |
| `GenericElementTree` | ✅ | ✅ | Tree explorer |
| `statusBarService` | ✅ | ✅ | Status bar items |
| `mainMenuService` | ✅ | ❌ | Main menu |
| `createLogger` | ❌ | ✅ (8×) | Namespaced logging |
| `SCROLL_MODES` | ✅ | ✅ | Scroll constants |

---

## Recommendations for SIDE (New Framework)

### Core APIs to Keep (Critical)

1. **`persistenceRegistry`** - Excellent API, add content-addressable helpers
2. **`eventBus`** - Solid pattern, document standard events
3. **`ideStore`** - Clear API, bridge to Svelte 5 runes
4. **`createTab`** - Improve hydration system
5. **`Tool`** (class) - Simplify registration
6. **`GenericElementTree`** - Solid component, document customization

### New Services to Create (Framework Gaps)

1. **`viewerRegistry`** - Extensible viewer/handler registry with automatic resolution
2. **`cacheService`** - HTTP cache primitives (ETag, conditional requests, stale-while-revalidate)
3. **`tabHydrationService`** - Declarative tab hydration system
4. **`stateSync`** - Cross-tool reactivity (Svelte 5 runes compatible)
5. **`hashStorage`** - Content-addressable storage helpers (hash, dedup)

### Existing API Improvements

1. **`persistenceRegistry.createPersister`**
   - Add `contentAddressable: true` option (automatic hashing)
   - Add `tenantId` global config vs per-persister

2. **`eventBus`**
   - Event typing (TypeScript generics)
   - Standard events catalog documentation

3. **`ideStore`**
   - Expose `tabs` as `$derived` vs raw array
   - Reactive API: `$activeTab`, `$tabCount`

4. **`createTab`**
   - Template descriptors (avoid params duplication)
   - Descriptor schema validation

5. **`GenericElementTree`**
   - Inline actions/context menu examples
   - Async children loading patterns

---

## Code Migration Examples

### Before (legacy - BNR-CVD)

```javascript
// documentStore.js - Manual content-addressable storage
export async function saveFileBlob(file) {
  const hash = await calculateFileHash(file)
  await persister.saveBlob(hash, file)
  return hash
}
```

### After (SIDE proposed)

```javascript
const persister = persistenceRegistry.createPersister('docs', 'binary', {
  contentAddressable: true,
  hashAlgorithm: 'SHA-256'
})

export async function saveFileBlob(file) {
  const { hash } = await persister.saveBlob(file)
  return hash
}
```

---

### Before (legacy - SAI KAIKA)

```javascript
// DataStore - Manual HTTP cache
async function isFilesCacheFresh(dossierId, meta, { forceRefresh }) {
  if (forceRefresh) return false
  const remote = await fetchDossierFilesFingerprint(dossierId)
  return remote?.etag === meta?.fingerprint
}
```

### After (SIDE proposed)

```javascript
const cache = cacheService.create('dossier-files', {
  strategy: 'stale-while-revalidate',
  revalidate: async (key) => {
    const response = await fetch(`/api/dossiers/${key}/files`, { method: 'HEAD' })
    return response.headers.get('ETag')
  }
})

const files = await cache.get(dossierId, () => fetchDossierFiles(dossierId))
```

---

## Potential Features (Single Project Usage)

### 1. Monaco Editor Integration (BNR-CVD only)

**Implementation** (`monacoModelManager.js`):
```javascript
const models = new Map()

export function getModel(documentId) {
  return models.get(documentId)
}

export function createModel(documentId, value, language) {
  const model = monaco.editor.createModel(value, language)
  models.set(documentId, model)
  return model
}

export function disposeModel(documentId) {
  const model = models.get(documentId)
  if (model) {
    model.dispose()
    models.delete(documentId)
  }
}
```

**Consideration**: Monaco is a specialized use case. Could provide official wrapper as optional package (`@svelte-ide/monaco`) rather than core framework.

---

### 2. LLM Streaming Orchestration (BNR-CVD only)

**Implementation** (`assistantController.js`):
```javascript
async function orchestrateFlow(initialMessage) {
  while (true) {
    const result = await runToolPhase()
    if (result.status === 'tool_executed' || result.status === 'planned') {
      continue
    }
    if (result.status === 'no_tool') break
    return
  }
  await startConversationStream()
}
```

**Consideration**: AI/LLM features are domain-specific. Could provide as optional package (`@svelte-ide/ai`) with SSE helpers, tool calling patterns, and streaming utilities.

---

### 3. Multi-Layered Canvas Architecture (SAI KAIKA only)

**Implementation** (`mc/` directory):
- Domain layers abstracts (OcrLayer, ComplianceLayer, ForensicLayer)
- Central controller coordinating layers
- Canvas-based visualization system

**Consideration**: Highly domain-specific visualization system. Not general-purpose enough for core framework. Could serve as example/reference implementation in documentation.

---

## Conclusion

Both projects use **10-12 critical core services** from the legacy framework, with consistent usage patterns:
- **Persistence** (content-addressable, multi-namespace)
- **Communication** (eventBus pub/sub)
- **Tabs** (lifecycle, hydration)
- **Auth** (lazy init, session)

**5 major framework gaps identified** where both projects built local solutions:
1. Contextual tab hydration system
2. Content-addressable storage pattern
3. HTTP cache with server fingerprinting
4. Cross-tool state reactivity
5. Extensible viewer/handler registry

The new SIDE framework should **preserve core APIs** (persistenceRegistry, eventBus, ideStore) and **add missing primitives** for the identified gaps.

**3 potential features** used by single projects could be provided as optional packages rather than core framework features.
