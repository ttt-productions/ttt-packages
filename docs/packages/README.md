# Package docs

One reference doc per `@ttt-productions/*` package. Each describes what that
package **owns**, its **boundary** (what it must not own or depend on), and its
public **entry points** — enough to use or change the package without reading its
source. Read the relevant package's doc before importing from it or changing it.

For the cross-cutting model — tiers, the dependency graph, root purity, subpath
conventions, direction rules, build/release order, internal version pinning, and
the boundary-guard tests — see [`package-architecture.md`](./package-architecture.md).
That doc is the source of truth for how the packages fit together; the
per-package docs each cover a single package.

## Per-package doc shape

- `# @ttt-productions/<name>` heading and a one-line purpose.
- `## Owns` — what the package is responsible for.
- `## Boundary` — what lives elsewhere and what it must not pull in. An optional
  `## Does not own` list may spell out tempting-but-excluded responsibilities.
- `## Entry points` — only when the package exposes more than its root. Each
  bullet leads with the real export subpath. A boundary test fails the build if a
  documented subpath is not an actual export, so keep these honest.

Generic packages stay app-agnostic; `ttt-core` is the one TTT-specific
application-data package, and its doc is correspondingly larger.
