# SIDE Vision

## Mission

**SIDE** (Svelte-IDE) - **Enterprise-grade** Svelte 5 IDE Framework.

Complete rewrite of the svelte-ide framework to create a professional library with modern API and robust architecture.

Use existing integration projects (BNR-CVD, SAI KAIKA) and the legacy svelte_ide to identify current limitations and build a modern, robust, and intuitive API for integrators.

> **Historical note:** This project was initially named "Phénix" during the rewrite phase. The final product is called **SIDE** (Svelte-IDE).

## Enterprise Quality Objectives

- Robust and maintainable architecture
- Clear and documented API for integrators
- Maximum extensibility without compromising stability
- Strict separation between core and capabilities
- Reusable and consistent patterns

## Architectural Principles

### 1. Framework / Integrators Separation

**Current structure (legacy):**
- Single project with `src/` (framework) + `test_tools/` mixed together
- `App.svelte` and `main.js` in the same folder
- "Hakish" architecture - no clean separation

**SIDE Vision:**

```
svelte-ide/
├── svelte-ide/             # Pure, abstract framework
│   ├── core/               # Core services
│   ├── stores/             # State management
│   ├── components/         # Framework UI components
│   └── index.js            # Export public API
│
├── explorer/            # Simulated integrator #1
│   ├── src/
│   ├── App.svelte
│   └── main.js
│
├── mes-finances/           # Simulated integrator #2
│   ├── src/
│   ├── App.svelte
│   └── main.js
│
└── ...                     # Other test integrators
```

**Key principle:** The framework (`svelte-ide/`) is completely independent, without `App.svelte` or `main.js`. Integrators create their own App and import the framework.

The framework also exports a post-auth app shell component (proposed: SideAppShell) that composes the IDE chrome. Integrators still own App.svelte and decide how to wrap BootGate and SideAppShell.

### 2. App Shell (Post-auth UI)

**Goal:** Define the parent component that renders the authenticated IDE chrome.

**Responsibilities:**
- Compose the chrome: title bar, top toolbar, sidebars, bottom console/panels, status bar
- Host overlays: modal host, context menu host, toast/notification host
- Own layout persistence, panel sizing, hydration, and visibility logic
- Render the capability host (SideContainer) in the main area

**Non-responsibilities:**
- Business logic of capabilities
- Integrator application state
- Authentication gating (handled by BootGate)

**Conceptual hierarchy:**
```svelte
<BootGate>
  <SideAppShell>
    <SideContainer />
  </SideAppShell>
</BootGate>
```
```
 <BootGate>
    <SideAppShell ...>
      <TitleBar />
      <TopToolbar />
      <MainLayout>
        <LeftSidebar />
        <MainArea>
          <SideContainer />
          <BottomPanel />
        </MainArea>
        <RightSidebar />
      </MainLayout>
      <StatusBar />
      <ModalHost />
      <ContextMenuHost />
      <ToastHost />
    </SideAppShell>
  </BootGate>
```

### 3. Theme System

**Objective:** Allow integrators to easily customize the global appearance.

**Features:**
- Global theme managed by a SIDE service
- Accessible style variables: colors, shadows, spacing, typography
- Framework components automatically inherit the theme
- Integrators' custom components easily retrieve styles

**Integrator usage:**
```javascript
import { themeService } from 'side'

const primaryColor = themeService.getColor('primary')
const boxShadow = themeService.getShadow('elevated')
```

Custom components must be able to integrate visually without effort.

### 4. Internationalization (i18n)

**Objective:** Multilingual support from initial design.

**Features:**
- Multilingual framework core by default
- Simple i18n service for integrators
- Natively supported languages: French, English (extensible)
- Dynamic language switching
- Translations accessible for custom components

**Principle:** The integrator must never hardcode text - everything goes through the i18n system.

### 5. Security by Default

**Objective:** Preserve and improve the current authentication system.

**Features:**
- Robust authentication by default
- Data encryption (IndexedDB with AES-256-GCM)
- Secure key management
- Protection of sensitive data

**Principle:** The application is secure from startup, without additional configuration from the integrator.

### 6. Simple and Reactive IndexedDB

**Objective:** Generic storage service, easy to use.

**Features:**
- Simple and intuitive API
- Native reactivity (Svelte 5 runes)
- Transparent encryption
- Automatic error and edge case management

**Integrator usage:**
```javascript
import { storageService } from 'side'

const myData = storageService.get('myKey')
storageService.set('myKey', newValue)
```

The integrator doesn't worry about underlying complexity (IndexedDB, encryption, transactions).

### 7. Robust Hydration and Layout

**Current problem:**
- Integrators must do "workarounds" for hydration to work
- Integrator behavior can break layout hydration
- Blurry responsibility between framework and integrator
- Complexity exposed to the integrator

**SIDE Vision:**
- Hydration completely managed by the framework app shell
- Layout saved/restored transparently by the app shell
- The integrator **never** touches interface mechanics
- Simple API for capabilities: declarative, not imperative

**Clarification:** SideContainer is a content host; it does not own chrome, overlays, or layout persistence.

**Fundamental principle:** The integrator focuses on **content** and **business rules**, not on SIDE mechanics.

**What the integrator does:**
- Define their capabilities (business features)
- Manage their application state
- Implement their business logic

**What the integrator does NOT do:**
- Manage layout lifecycle
- Worry about hydration
- Orchestrate panel/tab persistence
- Manipulate framework internals

### 8. Vocabulary Neutrality - No Imposed Terminology

**Critical problem identified in legacy:**

The term "tool" is used for **4 different concepts** simultaneously:

1. **IDE business modules** (Calculator, Explorer, etc.)
   - Class `Tool` with complex lifecycle
   - UI position, lifecycle hooks, focus management
   - What the integrator creates

2. **LLM callable functions** (in AI integrations)
   - In BNR-CVD: `validateJsonTool`, `editDocumentTool`
   - Completely different structure: `{ definition, handler }`
   - Separate registry with function calling semantics

3. **Folder names**
   - `src/test_tools/calculator/`
   - `frontend/src/tools/cv-assistant/`
   - Ambiguous: what does `tools/` contain?

4. **UI component names**
   - `Toolbar.svelte`, `ToolPanel.svelte`
   - CSS classes: `.tool-button`
   - Props: `topLeftTools`, `bottomTools`

**Real-world confusion example:**

```javascript
// Legacy pattern forces naming conventions
import explorerTool from './tools/explorer-tool/index.svelte.js'
const tools = [explorerTool, calculatorTool]
```

**The core problem:**

"Tool" is a **framework internal term** that has **leaked into the public API**. The integrator is forced to adopt SIDE's internal vocabulary instead of their own business terminology.

**Impact on integrators:**

- **Task manager app:** Mental model is "tasks", "views", "panels" but forced to write `taskManagerTool`, folder `tools/`, prop `tools={[...]}`
- **CRM system:** Mental model is "modules", "sections", "workspace" but must call everything "tool"
- **AI-powered apps:** Now has two conflicting meanings of "tool" (IDE modules vs LLM functions)

**SIDE Vision - Vocabulary Neutrality:**

The framework should NOT impose its internal terminology on integrators. Compare with React:
- React doesn't force you to call components `LoginReactComponent`, `DashboardReactComponent`
- You write `<Login />`, `<Dashboard />` using your domain language
- The framework doesn't leak its vocabulary into your code

**What SIDE should enable:**

```svelte
<!-- Integrator's business vocabulary -->
<SideContainer sections={[contactsView, salesView]} />
<SideContainer modules={[inbox, calendar, tasks]} />
<SideContainer panels={[explorer, console, terminal]} />
<SideContainer features={[chat, documents, analytics]} />
```

Instead of forcing:

```svelte
<!-- Framework's internal vocabulary -->
<SideContainer tools={[contactsTool, salesTool]} />
```

**Design principle:**

SideContainer is an internal host component. The public app shell API should accept integrator terms (modules, sections, features) and map internally to capabilities.

- "Tool" (or any internal term) should be an **implementation detail**
- The public API should accept integrator's natural terminology
- Internally, SIDE can use any naming it wants
- No imposed folder structure (`tools/` folder requirement)
- No imposed variable naming (`xxxTool` pattern)
- No CSS class name leakage (`.tool-button` → `.side-action-button`)

**Success criterion:**

An integrator building a medical records system should write `<SideContainer records={[patientRecord, labResults]}/>` and it just works, without ever seeing the word "tool" in their codebase.

## Development Approach

### Methodology

1. **Analyze** the legacy (`svelte_ide/`) and integrations (BNR-CVD, SAI KAIKA)
2. **Identify** pain points, limitations, repeated patterns
3. **Design** SIDE architecture with simplified API
4. **Develop** incrementally (core services → advanced features)
5. **Validate** with simulated integrators

### Success Criteria

An integrator succeeds in:
- Creating a functional capability in < 50 lines of code
- Integrating a custom theme in < 10 lines
- Adding a language in < 20 lines
- Persisting data without understanding IndexedDB
- **Never** touching framework code for standard needs

## References

- **Legacy:** `svelte_ide/` - Analyze patterns and limitations
- **Integrations:** BNR-CVD and SAI KAIKA - Real use cases
- **Standards:** `_GUIDES/SVELTE5.md` - Strict code norms
