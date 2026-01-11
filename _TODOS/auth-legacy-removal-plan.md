# Auth Legacy Removal Plan

## Context and Intent

This work applies to the SIDE framework in `side-phenix/`. The auth stack was ported from legacy and still supports a legacy token format. The goal is to simplify authentication by keeping a single modern token shape only, with strict configuration and no backward compatibility. This matches the project direction: minimal, deterministic boot and clean auth internals.

## Scope and Constraints

- Scope is limited to auth internals under `side-phenix/svelte-ide/`.
- Only Azure and Google providers are supported.
- No backward compatibility: existing stored tokens are invalid after the change; users must re-authenticate.
- Keep encrypted token persistence (`TokenCipher`) and `VITE_APP_KEY` namespacing.
- Keep public auth API stable for integrators.

## Files in Scope

- `side-phenix/svelte-ide/core/auth/TokenManager.svelte.js`
- `side-phenix/svelte-ide/core/auth/AuthManager.svelte.js`
- `side-phenix/svelte-ide/core/auth/providers/GoogleProvider.svelte.js`
- `side-phenix/svelte-ide/core/auth/providers/AzureProvider.svelte.js`

## Concepts and Ideas

- Single token format only: providers must return `tokens.accessTokens` (array), even for a single token.
- Deterministic boot: auth initialization fails fast if configuration is invalid or no providers are available.
- Token persistence remains encrypted through `TokenCipher` and keyed by `VITE_APP_KEY`.
- AuthStore API stays stable for integrators; internal changes are transparent at the call site.
- Logging uses the existing application logger with auth namespaces.
- Scope of change is limited to auth internals; no changes to tools, layout, or non-auth persistence.
- Provider differences to account for:
  - Google uses fixed endpoints, supports backend exchange, and may include a client secret (guarded by `allowInsecureClientSecret`).
  - Azure uses tenant-scoped endpoints and returns multiple access tokens for Graph + custom API scopes.
  - Google user identity comes from the OpenID userinfo endpoint; Azure extracts user info from the ID token and may fetch avatar via Graph.
  - Logout flows differ: Google opens a logout URL; Azure redirects to tenant logout with `post_logout_redirect_uri`.

## Implementation Steps

1. Update Google provider to return `tokens.accessTokens` with a single entry (include `expiresIn`, and align fields such as `scopes` and `audience` if required by the internal schema); preserve backend exchange and client-secret constraints.
2. Enforce multi-token format in `AuthManager.handleCallback()` and `AuthManager.login()`.
3. Remove legacy branches from `TokenManager` (legacy storage parsing, `setTokensLegacy`, legacy fields).
4. Update token storage serialization to persist only the multi-token schema.
5. Validate manual flows: initial login, page reload, token refresh, logout, OAuth callback handling; include Google backend exchange (if used) and Azure multi-scope refresh (Graph + custom API).
