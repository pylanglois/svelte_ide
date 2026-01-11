# SIDE Development Guides

## Essential Documents

### [VISION.md](./VISION.md)
Vision and objectives of the SIDE framework. Target architecture and fundamental principles.

### [SVELTE5_PATTERNS.md](./SVELTE5_PATTERNS.md) ⚠️ CRITICAL
**TO CONSULT BEFORE ANY SVELTE CODE**

Complete guide to validated Svelte 5 patterns:
- ✅ Allowed patterns
- ❌ Forbidden anti-patterns
- Reactivity decision tree
- Complete examples
- Validation checklist

**Problem solved:** Avoid invalid Svelte 5 code that caused countless bugs in the legacy project (infinite loops, non-executing $derived, legacy syntax).

## Code Validation

**Before commit:**
```bash
npm run lint
./.pre-commit-check.sh
```

**In case of error:**
1. Consult `SVELTE5_PATTERNS.md`
2. Verify Svelte 5 checklist
3. If in doubt, request user confirmation
