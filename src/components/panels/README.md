# Panels Directory

## ⚠️ ATTENTION - ARCHITECTURE CRITIQUE ⚠️

**NE PAS CRÉER de panels spécifiques aux outils dans ce dossier !**

### Panels autorisés dans ce dossier :
- ✅ `ConsolePanel.svelte` - Composant système de l'IDE
- ✅ `NotificationsPanel.svelte` - Composant système de l'IDE

### ❌ INTERDITS (violeraient la séparation IDE/Tools) :
- ❌ `ExplorerPanel.svelte` - Doit être chargé dynamiquement
- ❌ `CalculatorPanel.svelte` - Doit être chargé dynamiquement  
- ❌ Tout panel spécifique à un outil

### Principe de séparation :
L'IDE (`src/components/`) ne doit **JAMAIS** importer directement depuis `@tools/`.
Les outils sont chargés dynamiquement via `ToolPanel.svelte` uniquement.

### Si GitHub Copilot recrée des fichiers :
Supprimez-les immédiatement avec `Remove-Item` et ne pas utiliser "keep".
