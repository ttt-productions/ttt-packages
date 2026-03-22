# @ttt-productions/auth-core

Firebase Authentication utilities and React integration. Provides thin wrappers around Firebase Auth, custom claims parsing, and a full AuthProvider with hooks.

## Version
0.3.1

## Dependencies
Peer: firebase, react, react-dom.

## What It Contains

### Auth Utilities (`auth.ts`)
- `getAuthUser(auth)` — Get current Firebase Auth user (or null)
- `onAuthStateChanged(auth, cb, onError?)` — Thin wrapper around Firebase's `onAuthStateChanged`, returns unsubscribe function

### Claims (`claims.ts`)
Custom claims parsing for role-based access:
- `getIdTokenClaims(user)` — Get current user's ID token claims
- `refreshClaims(user)` — Force-refresh ID token + claims (e.g., after role change)
- `refreshClaimsFromAuth(auth)` — Convenience wrapper when you only have the Auth instance
- `parseClaims(claims)` → `{ roles: string[], raw: IdTokenClaims }` — Normalizes the `roles` claim into a string array regardless of whether it's stored as a string or array in custom claims

### Error Utilities (`errors.ts`)
Firebase Auth error handling helpers.

### Environment (`env.ts`)
Auth environment detection.

### React Integration (`react/`)
- `AuthProvider` — Context provider that manages auth state, claims, and loading states
- `useAuth()` — Access auth context (user, claims, loading, signOut, etc.)
- `useAuthState()` — Simplified auth state (authenticated/unauthenticated/loading)
- `useAuthGuard()` — Redirect unauthenticated users

## Key Design Decisions
- Claims parsing is intentionally minimal and generic — app-specific role logic lives in consuming apps.
- `refreshClaims` is critical after Cloud Functions modify custom claims (e.g., granting admin role) — the client must force-refresh to pick up the new claims.
- AuthProvider handles the full lifecycle: initial auth state resolution, claims fetching, and realtime auth state changes.

## Files
```
src/
  index.ts
  auth.ts, claims.ts, errors.ts, env.ts
  react/
    index.ts, types.ts
    AuthProvider.tsx, useAuth.ts, useAuthState.ts, useAuthGuard.ts
```
