# @ttt-productions/module-core

How a module is loaded lazily: the one memoized dynamic import every lazy load goes through.

## Owns

- **`lazyModule(load)`** — written at module level, `const loadX = lazyModule(() => import('x'))`.
  The module is imported on the loader's first call, and every later or concurrent call awaits that
  one import, so one importer never has two imports of a module in flight. A failed import is
  dropped, and the next call imports again, so a transient load failure (a network-fetched chunk)
  does not fail every later call.
- **Why one loader:** under vitest, a mock is served only to the first of two overlapping dynamic
  imports of a mocked module from one importer; the second gets the REAL module, so a test of a
  concurrent path silently runs real code. A bare `import()` at a usage site lets two calls overlap;
  the loader cannot. The package's own test pins that vitest behaviour, so an upgrade that changes
  it is noticed.

## Boundary

- No dependencies, no React, no Node built-ins; the root is server-safe (the boundary suite holds it
  `hard`), so a Cloud Functions tree, a browser app, and a Worker share the same loader.
- It loads nothing itself and knows no module names: which modules load lazily is the consumer's
  choice. A module that gains nothing from laziness is imported statically.
- Each app's guard suite (repo-guards' lazy-loader guard) is what keeps every dynamic import in the
  app's code on this shape; the package does not police its consumers.
