# Adopt @ttt-productions/repo-guards 0.1.49

**What:** The app-route guard also fails a hand-typed home link (`/`).
**Severity:** low

- **Package and version:** `@ttt-productions/repo-guards` 0.1.49.
- **Release:** `./scripts/release-multiple.sh repo-guards patch`.
- **What changed:** `appRouteOwner` ("app routes are built by the one route owner") now also flags
  the home path written by hand where it is used as a link: a `/` (alone, or before `?` or `#`) as
  a JSX `href` or `to`, as the first argument of `push`, `replace`, `navigate`, `redirect`,
  `permanentRedirect` or `prefetch`, given to a variable, parameter, or property whose name ends in
  `route` or `href`, or compared against one. A `/` anywhere else (a cookie path, a server route, a
  path split, `robots` `allow`) is not flagged. The facts are unchanged.
- **What the app must change:** the install only. ttt-prod's `src`, `functions/src`, and `shared`
  hold no `/` literal in a link position today (its home links already go through
  `APP_ROUTES.home()`); any site the suite lists is built with `APP_ROUTES.home()`, never an
  exception.
- **Done when:** The lockfile names `@ttt-productions/repo-guards` 0.1.49 or later, and the guard
  passes in ttt-prod's guard suite.
