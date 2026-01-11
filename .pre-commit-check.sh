#!/bin/bash

echo "🔍 Vérification Svelte 5..."

# Chercher syntaxe legacy interdite
echo "Recherche de syntaxe legacy..."

ERRORS=0

# export let
if grep -r "export let" side/ explorer/src/ --include="*.svelte" --include="*.svelte.js" 2>/dev/null; then
  echo "❌ ERREUR: 'export let' trouvé (utiliser \$props())"
  ERRORS=$((ERRORS + 1))
fi

# $: réactivité
if grep -r "\$:" side/ explorer/src/ --include="*.svelte" 2>/dev/null | grep -v "^\s*//" | grep -v "url"; then
  echo "❌ ERREUR: '\$:' trouvé (utiliser \$derived ou \$effect)"
  ERRORS=$((ERRORS + 1))
fi

# on:event (ignorer CSS :hover, :focus, etc.)
if grep -r '\son:[a-z]' side/ explorer/src/ --include="*.svelte" 2>/dev/null | grep -v "\..*:"; then
  echo "❌ ERREUR: 'on:event' trouvé (utiliser onclick, onchange, etc.)"
  ERRORS=$((ERRORS + 1))
fi

# createEventDispatcher
if grep -r "createEventDispatcher" side/ explorer/src/ --include="*.svelte" --include="*.js" 2>/dev/null; then
  echo "❌ ERREUR: 'createEventDispatcher' trouvé (utiliser callbacks)"
  ERRORS=$((ERRORS + 1))
fi

if [ $ERRORS -eq 0 ]; then
  echo "✅ Vérification Svelte 5 réussie"
  exit 0
else
  echo "❌ $ERRORS erreur(s) trouvée(s)"
  echo "Consulter: side-phenix/_GUIDES/SVELTE5_PATTERNS.md"
  exit 1
fi
