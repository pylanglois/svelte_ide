---
title: Signal "persistence ready" & séquencement d'hydratation
author: Codex (suite à la demande du dev outils)
date: 2025-11-10
---

# TL;DR
Le framework publie désormais deux signaux clés pour empêcher les outils d’accéder à IndexedDB avant que la clé de chiffrement ne soit disponible, et pour leur donner une fenêtre contrôlée de restauration :

1. `eventBus.publish('persistence:ready', { encrypted, services })` est émis dès que `indexedDBService` **et** `binaryStorageService` reçoivent la clé dérivée d’`authStore`.
2. `indexedDBService.readyForEncryption({ timeoutMs })` fournit une promesse que les outils peuvent await pour différer leur bootstrap chiffré.
3. L’hydratation du layout déclenche maintenant `hydration:before` → restauration des `stateProviders` → rafale `tab:hydrate` → `hydration:after`. `TabsManager` ignore toute sauvegarde durant cette fenêtre.

Ces ajouts découlent de la demande du dev outils qui voulait un moyen fiable de savoir quand hydrater un outil dépendant d’IndexedDB.

# Pourquoi ce changement ?
- Les outils étaient instanciés avant même qu’`App.svelte` n’ait installé la clé dans `IndexedDBService`.
- Certains utilisaient `bootstrapFromPersistedState()` qui lisait IndexedDB durant leur constructeur → données chiffrées illisibles ou snapshots vides sauvegardés par erreur.
- Les `stateProviders` pouvaient réécrire l’état d’un onglet pendant `tab:hydrate`, créant des courses difficiles à déboguer côté intégrateurs.

# Ce qui a été livré
| Zone | Fichier | Description |
| ---- | ------- | ----------- |
| Signal clé | `src/App.svelte` | Publication de `persistence:ready` et attente explicite de `indexedDBService.readyForEncryption()` avant `registerSystemTools()`/`registerExternalTools()`. |
| Service IndexedDB | `src/core/persistence/IndexedDBService.svelte.js` | Suivi d’un flag `encryptionReady`, promesse ré-initialisable, et timeout optionnel qui émet `persistence:error`. |
| Hydratation | `src/stores/ideStore.svelte.js`, `src/core/TabsManager.svelte.js` | `hydration:before/after`, restauration des `stateProviders` avant les `tab:hydrate`, blocage des sauvegardes pendant l’hydratation. |
| Outils dev | `src/test_tools/persistenceDiagnostics.svelte.js` | Helper pour logguer `persistence:*`/`hydration:*` via `window.installPersistenceDiagnostics()`. |
| Doc | `_GUIDES/PRODUCT.md`, `_GUIDES/ARCHITECTURE.md`, `_GUIDES/SVELTE5.md` | Ajout de la timeline et des instructions pour les auteurs d’outils. |

# Comment adopter côté outils ?
```js
import { eventBus } from '@/core/EventBusService.svelte.js'
import { indexedDBService } from 'svelte-ide/public-api'

export async function bootstrapTool() {
  await indexedDBService.readyForEncryption({ timeoutMs: 8000 }).catch(() => {
    console.warn('[MyTool] Persistence unavailable, fallback to memory store')
  })

  const unsubscribeReady = eventBus.subscribe('persistence:ready', ({ encrypted }) => {
    if (!encrypted) {
      // Basculer en lecture seule pendant un logout, par exemple.
    }
  })

  const unsubscribeHydrationBefore = eventBus.subscribe('hydration:before', () => {
    // Préparer caches, suspendre les sauvegardes user-driven, etc.
  })
  const unsubscribeHydrationAfter = eventBus.subscribe('hydration:after', () => {
    // Reprendre les sauvegardes, synchroniser l’UI.
  })

  return () => {
    unsubscribeReady()
    unsubscribeHydrationBefore()
    unsubscribeHydrationAfter()
  }
}
```

## Cas de figure à couvrir
1. **Timeout** : si `readyForEncryption()` rejette, l’outil doit soit basculer en storage en mémoire, soit afficher un message « Mode sans persistance ». L’événement `persistence:error` contient `{ reason: 'timeout', timeoutMs }`.
2. **Logout / expiration** : `persistence:ready` est rappelé avec `encrypted: false`, ce qui signale aux outils de purger leurs caches chiffrés.
3. **Hydratation partielle** : `hydration:before` est émis même s’il n’y a que des `stateProviders` à restaurer (0 onglet). `pendingTabs` dans le payload indique combien d’hydratations sont prévues.

# Vérifier dans un environnement local
1. Dans la console du navigateur, exécuter `window.installPersistenceDiagnostics()` → tous les événements sont loggés dans la console.
2. Forcer un refresh pendant qu’un outil persiste des données : vérifier que `hydration:before` arrive avant les `tab:hydrate` et que `TabsManager` n’écrit pas de layout tant que l’événement `hydration:after` n’a pas été publié.
3. Stopper l’auth backend (ou manipuler le réseau) pour vérifier que le timeout `persistence:error` est bien émis et qu’un outil réagit correctement.

# Prochaines étapes suggérées
- Mettre à jour chaque outil externe pour remplacer les `setTimeout`/pollings qui attendaient la clé par le combo `readyForEncryption()` + `persistence:ready`.
- Ajouter une option de configuration côté outils pour déclarer s’ils exigent la persistance (ex: bloquer l’UI si `encrypted !== true`).
- Ajouter des tests automatisés (ex: Playwright) qui vérifient que l’ouverture d’un onglet restauré ne sauvegarde pas de snapshot vide durant `hydration:before`.

# Références
- `_TODOS/framework-hydration-plan.md`
- `_GUIDES/ARCHITECTURE.md` (section « Cycle de persistance et d’hydratation »)
- `_GUIDES/SVELTE5.md` (section « Synchronisation avec la persistance & l’hydratation »)
- `src/test_tools/persistenceDiagnostics.svelte.js`
