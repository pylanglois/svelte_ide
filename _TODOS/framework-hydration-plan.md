---
title: Hydratation fiable du framework
version: 1.0.0
date_created: 2025-11-10
last_updated: 2025-11-10
---
# Plan de mise en œuvre : Garantir l’hydratation fiable des clients Svelte IDE
Mettre en place des signaux explicites et une séquence déterministe pour que les outils externes puissent hydrater leurs états chiffrés sans recourir à des hacks ou à des attentes arbitraires.

## Architecture et conception
L’idée directrice est de fournir aux intégrations un point unique de synchronisation sur la disponibilité de la clé de chiffrement et sur les différentes phases de restauration :
- Étendre `IndexedDBService`/`App.svelte` avec un événement `persistence:ready` (et une promesse optionnelle) publié dès que la clé issue de `authStore` est installée dans les services de persistance. L’événement couvrira à la fois `indexedDBService` et `binaryStorageService`, car ils reçoivent la même clé dans le même `$effect` de `src/App.svelte`.
- Introduire un enchaînement clair : `authStore.initialize()` → restauration des `stateProviders` → publication d’un hook `hydration:before` → publication des événements `tab:hydrate` → `hydration:after`.
- Documenter cette timeline et l’API événementielle dans `_GUIDES/ARCHITECTURE.md` + notes de migration pour les auteurs d’outils.

## Tâches
- [ ] Ajouter `eventBus.publish('persistence:ready', { encrypted: Boolean(authStore.encryptionKey) })` dans `src/App.svelte` et tester côté outils.
- [ ] Exposer une promesse/utilitaire `indexedDBService.readyForEncryption()` (résolue après `setEncryptionKey`) pour les intégrateurs qui préfèrent un await plutôt qu’un événement.
- [ ] Retarder `registerSystemTools()`/`toolManager.registerExternalTools()` tant que la promesse/événement "persistence ready" n’est pas réglé, afin d’éviter que des outils n’accèdent à IndexedDB sans clé.
- [ ] Réordonner `ideStore.restoreUserLayout()` pour restaurer `stateProviderService` avant les `tab:hydrate`, tout en ajoutant `hydration:before`/`hydration:after` sur l’`eventBus`.
- [ ] Adapter `TabsManager`/restauration des outils pour consommer les nouveaux hooks et éviter les sauvegardes intempestives tant que l’état n’est pas restauré.
- [ ] Ajouter/mettre à jour la documentation produit (PRODUCT.md, ARCHITECTURE.md, SVELTE5.md si nécessaire) avec la nouvelle séquence et l’événement.
- [ ] Écrire des tests ou scripts de reproduction (ex. test tool simulant un provider qui attend `persistence:ready`) pour valider l’absence de régression.
- [ ] Implémenter un timeout ou un événement `persistence:error` lorsque `readyForEncryption()` n’est jamais résolu (session expirée/offline) pour que les outils puissent dégrader proprement leur UI.

## Décisions actées
- Oui, on bloque l’instanciation des outils (système + externes) tant que la clé de chiffrement n’est pas confirmée par `persistence:ready`.
- Un seul canal `persistence:ready` suffit pour JSON et binaire, puisque `src/App.svelte` synchronise les deux services dans le même `$effect`; aucune divergence de timing attendue.
- On fournira un mécanisme d’erreur/timeout si la clé ne devient jamais disponible afin d’éviter que les outils restent bloqués sans feedback.
