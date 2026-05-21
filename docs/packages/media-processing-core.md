# @ttt-productions/media-processing-core

Generic server-side media processing package.

## Owns

- I/O-agnostic media pipeline
- Image/video/audio processing adapters
- Progress/cancellation plumbing
- Server Firebase Storage adapter on `./server`

## Boundary

The package consumes generic media shapes from `media-schemas` and server helpers from `firebase-helpers`. TTT processors own collection paths, moderation policy, storage relocation, and app-specific side effects.
