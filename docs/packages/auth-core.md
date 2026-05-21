# @ttt-productions/auth-core

Generic Firebase Auth package.

## Owns

- Auth provider and hooks
- Claims parsing helpers
- Server-side assert-auth factory pattern

## Boundary

App-specific user/project claim shapes are supplied by the consuming app. This package is the reference pattern for generic factory surfaces that bind TTT-specific values at the edge.
