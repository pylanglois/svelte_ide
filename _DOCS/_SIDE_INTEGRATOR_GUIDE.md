---
title: Guide rapide intégrateur svelte-ide
last_updated: 2025-xx-xx
---

# Ce que fournit le framework
L’IDE expose des services prêts à l’emploi pour brancher vos outils sans réinventer le layout, la persistance, la comm ou la sécurité. Ce guide liste toutes les briques disponibles (voir `src/public-api.js` pour les imports).

## Cycle de démarrage & hydratation
- `App` (racine) enregistre outils système puis externes **après** la disponibilité persistance.
- Signal `eventBus.publish('persistence:ready', { encrypted, services })` annonce que les services chiffrés sont prêts. Attendre ce signal avant d’écrire en IndexedDB.
- `indexedDBService.readyForEncryption({ timeoutMs })` (optionnel) : promesse pour bloquer votre bootstrap jusqu’à la clé.
- Hydratation orchestrée : `hydration:before` → `stateProviderService.restoreAllStates()` → rafale `tab:hydrate` pour chaque tab restaurable → `hydration:after`. Pendant cette fenêtre, `TabsManager` bloque les sauvegardes.

## Outils : déclaration et enregistrement
- Base `class Tool` (id, nom, icône, position `topLeft|bottomLeft|topRight|bottomRight|bottom`, visibilité `always|contextual`). `setComponent` pour relier le panel.
- `toolManager.registerExternalTools(entries)` ou `registerTool(tool)` : crée automatiquement le panel, l’icône toolbar et rattache le focus.
- Focus contextualisé : `toolFocusCoordinator` pour partager un groupe de focus entre outils/panels ; `tools:focus-group-changed` via `eventBus`.

## Onglets, layout et panels
- `ideStore.addTab(tab)` et `ideStore.openFile({ fileName, content, component, icon, toolId, scrollMode })` : ajoute un onglet et publie `tabs:added`/`tabs:activated`.
- `ideStore.closeTab(tabId)` gère le dirty-check via `ModalService` et publie `tabs:closed`.
- Dirty state : `setTabModified(tabId, bool)` ou `setFileModified(fileName, bool)`, événements `tabs:modified`/`file:modified`.
- Layout persistant : `ideStore.saveUserLayout()` (appelé automatiquement), `restoreUserLayout(user)` (déclenche les événements d’hydratation). `resetLayout()` pour repartir vierge.
- `layoutService` côté cœur : add/close/setActive, move/split via drag & drop (géré par `GenericLayoutService`/`DragDropService`), focus global par tab.
- `panelsManager` : enregistrement des panels créé automatiquement pour chaque tool (id stable `tool-${id}` ou `console-${id}`).
- `TabsManager` : hydratation des tabs via `tab:hydrate`, suivi `hydrationInProgress` pour bloquer les sauvegardes.

## Communication inter-composants
- `eventBus.publish/subscribe(event, payload)` (debug activable par `eventBus.setDebugMode(true)`). Événements système principaux : `persistence:*`, `hydration:*`, `tab:hydrate`, `tabs:*`, `file:*`, `storage:imported`, `tools:focus-group-changed`.

## Menus, barre de statut, modales, notifications
- Menus : `mainMenuService.registerMenu({ id?, label, order })`, `registerMenuItem(menuId, { id?, label|separator, order, shortcut, disabled, action })`, nettoyage par owner via `unregisterOwner`.
- Status bar : `statusBarService.registerItem(position, { id?, text (string|fn), component, props, order, className })`.
- Modales : `modalService.confirm/open({ icon, question, description, buttons })`, fermeture via `modalService.close/closeWithAction`.
- Notifications/console : `ideStore.addNotification(title, message, type='info', source)` avec compteur non lus ; `ideStore.addLog(message, type='info', tabTitle='Général')` + gestion des onglets console.

## Persistance & stockage
- Registre unique : `persistenceRegistry.createPersister(namespace, type='json'|'binary'|'localstorage'|'memory', options)` ; accès direct `save/load/remove/exists`.
- Blobs : `saveBlob/loadBlob/deleteBlob/listBlobs(namespace, ...)` (type `binary` requis).
- Import/Export : `exportNamespace(namespace)` (JSON ou ZIP), `importNamespace(namespace, data, { mode })`.
- Helpers menu prêts à l’emploi : `createExportAction`, `createImportAction`, `createExportAllAction`, `createImportAllAction`, `exportAllNamespaces`, `importAllNamespaces`.
- Persisters rétrocompatibles toujours exposés (`indexedDBService`, `binaryStorageService`, `storagePersistenceService`) mais privilégier le registre.
- `stateProviderService`: enregistrez un provider (`saveState/restoreState`) pour inclure vos stores dans la sauvegarde du layout utilisateur.

## Authentification & sécurité
- `getAuthStore()` : login/logout, `currentUser`, `isAuthenticated`, `availableProviders`, `encryptionKey`, `hasEncryptionKey`, `getAccessToken()`.
- Crypto & CSP : `TokenCipher`, `deriveEncryptionKey/clearEncryptionKey/isValidEncryptionKey`, `applyCsp`.
- Identifiants de storage namespacés : `APP_KEY`, `namespacedKey`.

## Préférences & UI système
- `preferencesService` : préférences système/outil/utilisateur (`getToolPreference`, `setToolPreference`, `getEffectivePreference`).
- Composants prêts à afficher dans le chrome : `AppLogo`, status bar items (ActiveTab, Clock, IndexedDBUsage, StatusMessage), `ReAuthModal`, `GenericElementTree`.

## Outils système inclus
- Console (`ConsoleTool`) et Notifications (`NotificationsTool`) déjà enregistrés ; réutilisez-les plutôt que de dupliquer ces fonctions.

## Bonnes pratiques intégrateur
- Attendre `persistence:ready` + éventuellement `indexedDBService.readyForEncryption()` avant toute lecture/écriture chiffrée.
- Sur `hydration:before`, suspendez vos sauvegardes ; connectez vos tabs lors de `tab:hydrate` puis relâchez à `hydration:after`.
- Utiliser `ideStore`/`layoutService` pour créer/détruire/activer des onglets et publier l’état dirty plutôt que manipuler le DOM ou le store Svelte interne.
- Nettoyer vos abonnements `eventBus` à la destruction des composants.

Référence détaillée : `_GUIDES/ARCHITECTURE.md`, `_DOCS/PERSISTENCE_READY_AND_HYDRATION.md`, `_DOCS/svelte-ide-tool-bootstrap.md`, code source des services mentionnés.
