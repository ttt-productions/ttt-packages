# Adopt @ttt-productions/repo-guards 0.1.50

**What:** The app-route guard's home-link check also catches `assign`, redirect-style names, and a
home link built as a template.
**Severity:** low

- **Package and version:** `@ttt-productions/repo-guards` 0.1.50.
- **Release:** `./scripts/release-multiple.sh repo-guards patch`.
- **What changed:** `appRouteOwner` ("app routes are built by the one route owner") now also flags
  a hand-typed home path (`/`, alone or before `?` or `#`) as the first argument of `assign`
  (`location.assign('/')`); given to a variable, parameter, or property whose name ends in
  `redirect`, `redirectTo`, `redirectUrl`, `returnTo`, `returnUrl`, `callbackUrl`, `nextUrl` or
  `destination` (beside `route` and `href`); and a template literal in any link position whose
  opening text is `/?` or `/#` (`` `/?tab=${tab}` ``). A template like `` `/${slug}` ``, a bare
  `url` name (a request fake's `url = '/'`), and every `/` outside a link position still pass. The
  facts are unchanged.
- **What the app must change:** the install only. ttt-prod's `src`, `functions/src`, and `shared`
  hold none of the newly caught forms today; any site the suite lists is built with
  `APP_ROUTES.home()`, never an exception.
- **Done when:** The lockfile names `@ttt-productions/repo-guards` 0.1.50 or later, and the guard
  passes in ttt-prod's guard suite.
