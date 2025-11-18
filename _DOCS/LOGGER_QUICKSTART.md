# Guide Rapide : Système de Logging Applicatif

Le framework svelte-ide expose un système de logging centralisé et filtrable via `createLogger()`. Ce guide montre comment l'utiliser dans vos outils externes.

## Import

```javascript
import { createLogger } from 'svelte-ide'
```

## Utilisation de Base

```javascript
// Créer un logger pour votre outil avec un namespace unique
const logger = createLogger('mon-outil/mon-module')

// Différents niveaux de log
logger.debug('Message de debug détaillé')
logger.info('Information générale')
logger.warn('Avertissement')
logger.error('Erreur critique', error)

// Afficher un tableau
logger.table([
  { id: 1, nom: 'Alice' },
  { id: 2, nom: 'Bob' }
])
```

## Namespaces et Filtrage

Le système utilise des **namespaces** pour filtrer les logs. Par défaut, **aucun log n'est affiché** à moins d'activer explicitement les namespaces souhaités.

### Configuration via Variables d'Environnement

```bash
# Activer tous les logs
VITE_LOG_NAMESPACES=*

# Activer uniquement certains namespaces
VITE_LOG_NAMESPACES=mon-outil,core/auth

# Activer par préfixe (insensible à la casse)
VITE_LOG_NAMESPACES=core/,test-tools/

# Désactiver tous les logs (par défaut)
VITE_LOG_NAMESPACES=
```

### Configuration Dynamique (Console Navigateur)

```javascript
// Activer tous les logs
window.ideLogs.setNamespaces('*')

// Activer des namespaces spécifiques
window.ideLogs.setNamespaces('mon-outil,core/persistence')

// Voir la configuration actuelle
window.ideLogs.getConfig()
// → { level: 'debug', namespaces: ['mon-outil'], allowAll: false }

// Changer le niveau de log minimal
window.ideLogs.setLevel('info')  // Masque les logs 'debug'
```

## Niveaux de Log

Les niveaux disponibles (par priorité croissante) :

1. **debug** : Détails de développement
2. **info** : Information générale
3. **warn** : Avertissements
4. **error** : Erreurs critiques

Par défaut :
- **Développement** (`DEV`) : niveau `debug` (tout afficher)
- **Production** : niveau `info` (masque les `debug`)

## Exemples d'Intégration

### Dans un Outil Externe

```javascript
// mon-outil/index.svelte.js
import { Tool, createLogger } from 'svelte-ide'
import MonOutilComponent from './MonOutil.svelte'

const logger = createLogger('mon-outil')

export class MonOutil extends Tool {
  constructor() {
    super('Mon Outil', '🔧', 'topLeft', 'mon-outil')
    logger.info('Outil initialisé')
  }

  initialize() {
    this.setComponent(MonOutilComponent)
    logger.debug('Composant lié:', MonOutilComponent.name)
  }
}

export function register(toolManager) {
  const tool = new MonOutil()
  toolManager.registerTool(tool)
  logger.info('Outil enregistré avec succès')
}
```

### Dans un Service de Restauration

```javascript
// mon-outil/RestorationService.svelte.js
import { eventBus, createLogger } from 'svelte-ide'

const logger = createLogger('mon-outil/restoration')

class MonOutilRestorationService {
  constructor() {
    logger.debug('Service de restauration créé')
    
    eventBus.subscribe('hydration:before', () => {
      logger.info('Préparation de la réhydratation')
    })
    
    eventBus.subscribe('tab:hydrate', (data) => {
      if (data.resourceId === 'mon-resource') {
        logger.debug('Réhydratation de l'onglet:', data)
        this.handleHydrate(data)
      }
    })
  }

  async handleHydrate(data) {
    try {
      logger.info('Restauration du contenu pour:', data.fileName)
      // ... logique de restauration
      logger.debug('Restauration réussie')
    } catch (error) {
      logger.error('Échec de la restauration:', error)
    }
  }
}
```

### Dans un Composant Svelte

```svelte
<!-- MonOutil.svelte -->
<script>
  import { createLogger } from 'svelte-ide'
  
  const logger = createLogger('mon-outil/component')
  
  let count = $state(0)
  
  function increment() {
    count++
    logger.debug('Compteur incrémenté:', count)
  }
  
  $effect(() => {
    logger.info('Composant monté')
    
    return () => {
      logger.info('Composant démonté')
    }
  })
</script>

<button onclick={increment}>
  Compteur: {count}
</button>
```

## Bonnes Pratiques

### 1. Namespaces Cohérents

Utilisez une hiérarchie claire :

```javascript
// ✅ BON
createLogger('mon-outil')                    // Racine de l'outil
createLogger('mon-outil/service')            // Sous-module
createLogger('mon-outil/restoration')        // Service spécifique
createLogger('mon-outil/component/editor')   // Composant UI

// ❌ MAUVAIS
createLogger('MonOutil')                     // Majuscules non conventionnelles
createLogger('tool_service')                 // Pas de hiérarchie
createLogger('my-tool-restoration-svc')      // Trop verbeux
```

### 2. Choisir le Bon Niveau

```javascript
// ✅ BON
logger.debug('Variable locale:', localVar)    // Détails internes
logger.info('Outil chargé')                   // Événements importants
logger.warn('Cache périmé, rechargement')     // Situation anormale mais gérable
logger.error('Échec API:', error)             // Erreur bloquante

// ❌ MAUVAIS
logger.info('Variable i:', i)                 // Trop verbeux → debug
logger.debug('Erreur critique:', error)       // Sous-estimé → error
logger.error('Bouton cliqué')                 // Sur-estimé → info ou debug
```

### 3. Logs Contextuels

```javascript
// ✅ BON - Context clair
logger.info('Fichier ouvert:', { fileName, size, mimeType })
logger.error('Échec de sauvegarde:', { fileName, error: error.message })

// ❌ MAUVAIS - Context manquant
logger.info('Ouvert')
logger.error('Erreur', error)
```

### 4. Éviter les Logs Excessifs

```javascript
// ❌ MAUVAIS - Log dans une boucle
items.forEach(item => {
  logger.debug('Traitement:', item)  // Peut générer 1000+ logs
})

// ✅ BON - Log groupé
logger.debug('Traitement de', items.length, 'éléments')
logger.table(items)  // Si besoin de détails
```

## Debugging

### Activer les Logs pour un Namespace Spécifique

```javascript
// Dans la console navigateur pendant le développement
window.ideLogs.setNamespaces('mon-outil')
```

### Voir Tous les Logs Temporairement

```javascript
window.ideLogs.setNamespaces('*')
// Reproduire le problème
window.ideLogs.setNamespaces('')  // Désactiver après
```

### Vérifier la Configuration

```javascript
window.ideLogs.getConfig()
// → { level: 'debug', namespaces: ['mon-outil'], allowAll: false }
```

## API Complète

### `createLogger(namespace)`

Retourne un objet logger avec les méthodes :

- `logger.debug(...args)` - Log de niveau debug
- `logger.info(...args)` - Log de niveau info
- `logger.log(...args)` - Alias pour `info`
- `logger.warn(...args)` - Avertissement
- `logger.error(...args)` - Erreur
- `logger.table(...args)` - Affiche un tableau (console.table)

### `configureLogger(options)`

Configure globalement le logger :

```javascript
import { configureLogger } from 'svelte-ide'

configureLogger({
  namespaces: 'mon-outil,core/*',  // Namespaces à activer
  level: 'info'                     // Niveau minimal
})
```

### `getLoggerConfig()`

Retourne la configuration actuelle :

```javascript
import { getLoggerConfig } from 'svelte-ide'

const config = getLoggerConfig()
console.log(config)
// → { level: 'info', namespaces: ['mon-outil'], allowAll: false }
```

## Comparaison avec Console Native

| Feature | `console.log` | `createLogger` |
|---------|---------------|----------------|
| Filtrage par module | ❌ | ✅ |
| Niveaux de log | ⚠️ (manuel) | ✅ (automatique) |
| Namespace visible | ❌ | ✅ |
| Configuration globale | ❌ | ✅ |
| Silencieux en prod | ❌ | ✅ (par défaut) |
| Performance | Rapide | Rapide (early return si désactivé) |

## Conclusion

Le système de logging de svelte-ide offre :
- ✅ Filtrage fin par namespace
- ✅ Niveaux de log standard
- ✅ Configuration dynamique (runtime)
- ✅ Silencieux par défaut (pas de pollution console)
- ✅ Compatible avec tous les outils externes

Utilisez-le pour garder vos logs organisés et déboguer efficacement sans polluer la console en production.
