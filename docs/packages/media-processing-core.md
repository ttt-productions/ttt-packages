# @ttt-productions/media-processing-core

Generic server-side media processing package.

## Owns

- I/O-agnostic media pipeline
- Image/video/audio processing helpers
- Temp workspace and processing adapter utilities
- Server Firebase Storage adapter on `./server`

## Boundary

The package consumes generic media shapes from `media-schemas` and keeps Firebase Admin as a peer/runtime concern. TTT processors own collection paths, moderation policy, storage relocation, and app-specific side effects.

The root entry (`.`) is one of only two intentional exceptions to the monorepo's root-purity rule (see `package-architecture.md`) — it is Node-only (spawns `ffmpeg` via `node:child_process`, uses `node:fs`/`node:os`), not a universal/server-safe surface like every other package's root.
