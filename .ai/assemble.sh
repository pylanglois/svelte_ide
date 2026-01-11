#!/bin/bash

# Script d'assemblage des instructions IA
# Génère AI_INSTRUCTIONS.md depuis les modules .ai/

cd "$(dirname "$0")/.."

cat > AI_INSTRUCTIONS.md << 'HEADER'
# Instructions IA - SIDE

> Compatible: Claude Code, GitHub Copilot, Cursor, Windsurf
> **Généré automatiquement depuis `.ai/`** - Ne pas éditer directement

**SIDE (Svelte-IDE)** - Framework IDE Svelte 5 de qualité entreprise

HEADER

echo "" >> AI_INSTRUCTIONS.md
cat .ai/rules.md >> AI_INSTRUCTIONS.md
echo "" >> AI_INSTRUCTIONS.md
echo "---" >> AI_INSTRUCTIONS.md
echo "" >> AI_INSTRUCTIONS.md
cat .ai/svelte5.md >> AI_INSTRUCTIONS.md
echo "" >> AI_INSTRUCTIONS.md
echo "---" >> AI_INSTRUCTIONS.md
echo "" >> AI_INSTRUCTIONS.md
cat .ai/architecture.md >> AI_INSTRUCTIONS.md
echo "" >> AI_INSTRUCTIONS.md
echo "---" >> AI_INSTRUCTIONS.md
echo "" >> AI_INSTRUCTIONS.md
cat .ai/backend.md >> AI_INSTRUCTIONS.md
echo "" >> AI_INSTRUCTIONS.md
echo "---" >> AI_INSTRUCTIONS.md
echo "" >> AI_INSTRUCTIONS.md
cat .ai/frontend.md >> AI_INSTRUCTIONS.md
echo "" >> AI_INSTRUCTIONS.md
echo "---" >> AI_INSTRUCTIONS.md
echo "" >> AI_INSTRUCTIONS.md
cat .ai/checklist.md >> AI_INSTRUCTIONS.md
echo "" >> AI_INSTRUCTIONS.md
echo "---" >> AI_INSTRUCTIONS.md
echo "" >> AI_INSTRUCTIONS.md
cat .ai/standards.md >> AI_INSTRUCTIONS.md

cp AI_INSTRUCTIONS.md CLAUDE.md
cp AI_INSTRUCTIONS.md AGENTS.md
cp AI_INSTRUCTIONS.md .github/copilot-instructions.md

echo "✅ AI_INSTRUCTIONS.md généré depuis .ai/"
