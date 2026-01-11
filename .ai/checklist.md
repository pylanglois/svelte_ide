# Simplicity Checklists

> Verifications before finalizing code

## Backend Checklist (Python)

Before finalizing Python code, verify:

1. **Pure function sufficient?**
   - Don't create class if a pure function does the job
   - Class justified only if state or external integration

2. **Direct library call possible?**
   - Don't wrap unnecessarily
   - Use library directly if possible

3. **File > 100 lines without justification?**
   - Split by responsibility
   - One file = one clear responsibility

4. **Superfluous state/class?**
   - Remove dead code
   - Avoid unnecessary abstractions

5. **Complex abstraction?**
   - Verify if necessary
   - Prefer simple and direct to abstract and flexible

## Frontend Checklist (Svelte 5)

Before finalizing Svelte code, verify:

1. **Component < 150 lines?**
   - Otherwise split into sub-components
   - One component = one responsibility

2. **$derived possible or $effect necessary?**
   - $derived = DIRECT dependencies and pure computations
   - $effect = INDIRECT dependencies or side effects

3. **No infinite loop?**
   - NEVER read AND modify the same variable in $effect
   - Use guards if necessary

4. **Explicit variable names?**
   - Self-documenting code
   - No comments necessary

5. **Necessary abstraction or over-engineering?**
   - Avoid complexity creep
   - Simple > Prematurely flexible

## General Checklist

For all code (backend or frontend):

1. **No comments?**
   - Code must speak for itself
   - Explicit names suffice

2. **Try/catch justified?**
   - Only critical cases
   - Explicit business exceptions

3. **Manual tests planned?**
   - AI doesn't generate automated tests
   - User tests manually

4. **Dead code removed?**
   - No commented code
   - No unused functions

5. **Svelte 5 validation passed?**
   - `npm run validate` without errors
   - No legacy syntax
