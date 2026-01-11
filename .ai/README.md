# Modular AI Instructions

This folder contains the **SIDE** (Svelte-IDE) framework AI instructions as reusable modules.

## Structure

```
.ai/
├── rules.md          # Interaction rules (style, prohibitions, builds)
├── svelte5.md        # Svelte 5 validation (checklist, debugging, anti-patterns)
├── architecture.md   # Project structure, public API, commands
├── standards.md      # Code standards, tech stack, glossary
├── backend.md        # Python standards (integrators with backend)
├── frontend.md       # Detailed Svelte 5 standards
├── checklist.md      # Simplicity checklists (backend + frontend)
├── assemble.sh       # Assembly script
└── README.md         # This file
```

## Workflow

**Edit a module:**
```bash
# Edit a specific aspect
vim .ai/rules.md           # Modify interaction rules
vim .ai/svelte5.md         # Modify Svelte 5 validation
```

**Generate AI_INSTRUCTIONS.md:**
```bash
npm run assemble:ai        # Generates AI_INSTRUCTIONS.md
```

The `AI_INSTRUCTIONS.md` file is automatically generated from these modules. **Do not edit it directly.**

## Generated Files

After assembly, the following files point to `AI_INSTRUCTIONS.md`:
- `CLAUDE.md` - Claude Code
- `.github/copilot-instructions.md` - GitHub Copilot
- `.cursorrules` - Cursor

All AI tools read the same content.

## Advantages

- ✅ Targeted and reusable modules
- ✅ Easy editing (one aspect at a time)
- ✅ No duplication
- ✅ Compatible with all AI tools
- ✅ Single source of truth
