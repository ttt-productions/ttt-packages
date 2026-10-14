# Media packages (MEDIA)

Rules for media viewer and renderer packages. The upload path shape is a cross-cutting invariant
documented in `docs/design/upload-path-invariant.md`; the app owns its origins and paths. Format and
IDs: [README.md](README.md).

### MEDIA-102 — One IntersectionObserver per viewer

**Rule.** A media viewer owns at most one observer (one `useInView`) on its outer wrapper; multiple
visibility thresholds use that one observer with a `threshold` array and derive each signal from the
entry. Wrappers around a nested viewer own no observer. Canonical: `video-viewer.tsx` —
`useInView({ threshold: [0, 0.5] })`, `0` for lazy-load and `0.5` for autoplay.

**Why.** A second observer multiplies churn and desyncs the lazy-load, autoplay, and unload signals.

**Prohibits.**
- A second observer in a viewer, or observing the inner media element separately.
- A wrapper constructing an observer around a nested viewer.

**References.** `docs/packages/media-viewer.md`.
