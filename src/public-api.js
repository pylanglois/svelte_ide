import './lib/setupLogging.js'

export { default as App } from './App.svelte'
export { default as AppLogo } from './components/layout/chrome/AppLogo.svelte'
export { default as StatusBarActiveTabItem } from './components/layout/chrome/statusbar/ActiveTabItem.svelte'
export { default as StatusBarClockItem } from './components/layout/chrome/statusbar/ClockItem.svelte'
export { default as StatusBarIndexedDBUsageItem } from './components/layout/chrome/statusbar/IndexedDBUsageItem.svelte'
export { default as StatusBarMessageItem } from './components/layout/chrome/statusbar/StatusMessageItem.svelte'
export { default as ReAuthModal } from './components/system/ReAuthModal.svelte'
export { avatarCacheService } from './core/auth/AvatarCacheService.svelte.js'
export { getTokenSecurityConfig } from './core/auth/tokenSecurityConfig.svelte.js'
export { APP_KEY, namespacedKey } from './core/config/appKey.js'
export { eventBus } from './core/EventBusService.svelte.js'
export { mainMenuService } from './core/MainMenuService.svelte.js'
export { createExportAction, createExportAllAction, createImportAction, createImportAllAction, exportAllNamespaces, importAllNamespaces } from './core/MenuActionsHelpers.svelte.js'
export { MODAL_CANCELLED_BY_X, modalService } from './core/ModalService.svelte.js'
export { registerBackupMenu } from './core/registerBackupMenu.svelte.js'
export { applyCsp } from './core/security/csp.svelte.js'
export { TokenCipher } from './core/security/tokenCipher.svelte.js'
export { statusBarService } from './core/StatusBarService.svelte.js'
export { registerStorageMenu } from './core/StorageMenuHelper.svelte.js'
export { ConsoleTool, NotificationsTool } from './core/SystemTools.js'
export { Tool } from './core/Tool.svelte.js'
export { toolManager } from './core/ToolManager.svelte.js'
export { getAuthStore } from './stores/authStore.svelte.js'
export { ideStore } from './stores/ideStore.svelte.js'

// Persistence API
export { BinaryPersister } from './core/persistence/BinaryPersister.svelte.js'
export { JsonPersister } from './core/persistence/JsonPersister.svelte.js'
export { PersistenceRegistry, persistenceRegistry } from './core/persistence/PersistenceRegistry.svelte.js'
export { LocalStoragePersister, MemoryPersister, PersisterInterface, SimplePersister } from './core/persistence/PersisterInterface.js'

// Persistence implementations (rétrocompatibilité)
// Rétrocompatibilité (deprecated)
export { BinaryStorageService, binaryStorageService, getBinaryStorageService } from './core/persistence/BinaryStorageService.svelte.js'
export { getIndexedDBService, IndexedDBService, indexedDBService } from './core/persistence/IndexedDBService.svelte.js'
export { JsonPersister as IndexedDBPersister } from './core/persistence/JsonPersister.svelte.js'

// Dérivation de clé de chiffrement
export {
    clearEncryptionKey, deriveEncryptionKey,
    isValidEncryptionKey
} from './core/auth/EncryptionKeyDerivation.svelte.js'
