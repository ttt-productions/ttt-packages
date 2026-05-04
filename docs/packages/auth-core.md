# @ttt-productions/auth-core

Firebase Authentication utilities and React integration. Provides thin wrappers around Firebase Auth, custom claims parsing, and a full AuthProvider with hooks.

## Version
0.3.2

## Dependencies
Peer: firebase, react, react-dom.

## Entry Points

- `@ttt-productions/auth-core` — server-safe/client-safe auth utilities, claims helpers, error helpers, and environment helpers.
- `@ttt-productions/auth-core/react` — AuthProvider, AuthContext, auth hooks, guard hook, and React-specific types.

## What It Contains

### Server-safe main entry (`index.ts`)
- Auth utilities from `auth.ts`: `getAuthUser(auth)`, `onAuthStateChanged(auth, cb, onError?)`
- Claims helpers from `claims.ts`: `getIdTokenClaims(user)`, `refreshClaims(user)`, `refreshClaimsFromAuth(auth)`, `parseClaims(claims)`
- Error helpers from `errors.ts`
- Environment helpers from `env.ts`: `getAppEnvironment()`, `isDevelopment()`, `isProduction()`

### React entry point (`react/index.ts`)
- `AuthProvider` — Context provider that manages auth state, claims, profile loading, and lifecycle callbacks
- `AuthContext`
- `useAuth()` — Access auth context
- `useAuthState()` — Simplified Firebase auth state
- `useAuthGuard()` — Redirect unauthenticated users
- React-specific provider/guard types

## Key Design Decisions
- Claims parsing is intentionally minimal and generic — app-specific role logic lives in consuming apps.
- `refreshClaims` is critical after Cloud Functions modify custom claims (e.g., granting admin role) — the client must force-refresh to pick up the new claims.
- AuthProvider handles the full lifecycle: initial auth state resolution, claims fetching, profile subscription, and realtime auth state changes.
- React runtime exports live on `/react`; main stays free of React imports.

## Files
```
src/
  index.ts
  auth.ts, claims.ts, errors.ts, env.ts
  react/
    index.ts, types.ts
    AuthProvider.tsx, useAuth.ts, useAuthState.ts, useAuthGuard.ts
```
