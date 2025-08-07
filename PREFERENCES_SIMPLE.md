# Système de Préférences - Version Simplifiée

## Vue d'ensemble

Le `PreferencesService` fournit un système de configuration à 3 niveaux pour l'IDE :

1. **Préférences système** : Valeurs par défaut de l'IDE (non modifiables pour l'instant)
2. **Préférences outils** : Configuration spécifique aux outils
3. **Préférences utilisateur** : Surcharges personnalisées (future fonctionnalité)

## Utilisation

### Dans un composant IDE

```javascript
import { ideStore } from '@/stores/ideStore.svelte.js'

// Lire une préférence système
const showStatusBar = ideStore.preferences.getEffectivePreference('ide.showStatusBar', true)

// Lire une préférence d'outil
const showHidden = ideStore.preferences.getToolPreference('explorer', 'showHidden', false)
```

### Dans un composant Svelte

```svelte
<script>
  import { ideStore } from '@/stores/ideStore.svelte.js'
  
  let showStatusBar = $state(true)
  
  $effect(() => {
    showStatusBar = ideStore.preferences.getEffectivePreference('ide.showStatusBar', true)
  })
</script>

{#if showStatusBar}
  <div class="status-bar">...</div>
{/if}
```

### Dans un outil

```javascript
export class ExplorerTool extends Tool {
  constructor() {
    super('explorer', 'Explorateur', '📁', 'topLeft')
  }
  
  initialize() {
    // Configurer une préférence d'outil
    ideStore.preferences.setToolPreference('explorer', 'showHidden', false)
    
    // Lire la préférence
    const showHidden = ideStore.preferences.getToolPreference('explorer', 'showHidden', false)
  }
}
```

## Préférences Système Disponibles

### IDE
- `ide.showStatusBar` (boolean) : Affichage de la barre de statut
- `ide.showToolbar` (boolean) : Affichage de la barre d'outils  
- `ide.autoSave` (boolean) : Sauvegarde automatique
- `ide.autoSaveDelay` (number) : Délai de sauvegarde automatique (ms)
- `ide.confirmCloseTab` (boolean) : Confirmation avant fermeture d'onglet

### Notifications
- `notifications.duration` (number) : Durée d'affichage (ms)
- `notifications.position` (string) : Position ('bottom-right', 'top-right', etc.)

### Éditeur
- `editor.tabSize` (number) : Taille des tabulations
- `editor.insertSpaces` (boolean) : Utiliser des espaces au lieu de tabs
- `editor.wordWrap` (boolean) : Retour à la ligne automatique  
- `editor.lineNumbers` (boolean) : Affichage des numéros de ligne

## API

### `getEffectivePreference(key, defaultValue)`
Obtient la valeur effective d'une préférence (avec hiérarchie user → tool → system).

### `getToolPreference(toolId, property, defaultValue)`
Raccourci pour lire une préférence d'outil.

### `setToolPreference(toolId, property, value)`
Définit une préférence d'outil.

### `getAllPreferences()`
Retourne toutes les préférences organisées par niveau.

## Évolution Future

- Interface utilisateur pour modifier les préférences
- Persistence des préférences utilisateur
- Validation des valeurs
- Thèmes et configurations avancées
