# VSCode Configuration

## Debug the Explorer MVP

### Option 1: Automatic Launch (Recommended)

1. Open the project in VSCode
2. `F5` or "Run > Start Debugging"
3. Select "Launch MVP Explorateur"

→ Automatically launches `npm run dev` and opens Chrome with attached debugger

### Option 2: Manual Attach

1. Launch the server manually:
   ```bash
   cd explorer
   npm run dev
   ```

2. In VSCode: `F5` and select "Attach to Chrome"

## Breakpoints

Breakpoints work in:
- `.svelte` files (template + script)
- `.svelte.js` files
- Framework services `side/`

## Notes

- Default port: `5173` (Vite)
- Chrome must be installed
- Debugger automatically connects to Vite server
