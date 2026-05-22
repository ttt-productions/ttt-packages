# @ttt-productions/media-processing-core

Generic server-side media processing package.

## Owns

- I/O-agnostic media pipeline
- Image/video/audio processing helpers
- Temp workspace and processing adapter utilities
- Server Firebase Storage adapter on `./server`

## Boundary

The package consumes generic media shapes from `media-schemas` and keeps Firebase Admin as a peer/runtime concern. TTT processors own collection paths, moderation policy, storage relocation, and app-specific side effects.
