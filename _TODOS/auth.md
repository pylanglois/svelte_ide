 
NON tout ce qui est disponible dans index.js doit être rendu disponible:
- initializeAuthProviders(authManager)
    - Reads VITE_AUTH_PROVIDERS and enforces strict configuration.
    - Only azure and google are allowed; anything else throws.

authStore est fortement couplé au provider azure et google. il faut qui charge de manière aveugle la liste de index.js et que chaque provider s'initialise lui même.


TokenManager: grosse classe