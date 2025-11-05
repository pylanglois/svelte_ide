export { default as App } from './App.svelte'
export { default as AppLogo } from './components/layout/chrome/AppLogo.svelte'
export { default as StatusBarActiveTabItem } from './components/layout/chrome/statusbar/ActiveTabItem.svelte'
export { default as StatusBarClockItem } from './components/layout/chrome/statusbar/ClockItem.svelte'
export { default as StatusBarMessageItem } from './components/layout/chrome/statusbar/StatusMessageItem.svelte'
export { default as ReAuthModal } from './components/system/ReAuthModal.svelte'
export { getTokenSecurityConfig } from './core/auth/tokenSecurityConfig.svelte.js'
export { APP_KEY, namespacedKey } from './core/config/appKey.js'
export { eventBus } from './core/EventBusService.svelte.js'
export { mainMenuService } from './core/MainMenuService.svelte.js'
export { MODAL_CANCELLED_BY_X, modalService } from './core/ModalService.svelte.js'
export { applyCsp } from './core/security/csp.svelte.js'
export { TokenCipher } from './core/security/tokenCipher.svelte.js'
export { statusBarService } from './core/StatusBarService.svelte.js'
export { ConsoleTool, NotificationsTool } from './core/SystemTools.js'
export { Tool } from './core/Tool.svelte.js'
export { toolManager } from './core/ToolManager.svelte.js'
export { ideStore } from './stores/ideStore.svelte.js'

// IndexedDB persistance sécurisée
export { IndexedDBService, getIndexedDBService, indexedDBService } from './core/persistence/IndexedDBService.svelte.js'

// Dérivation de clé de chiffrement
export {
    clearEncryptionKey, deriveEncryptionKey,
    isValidEncryptionKey
} from './core/auth/EncryptionKeyDerivation.svelte.js'

