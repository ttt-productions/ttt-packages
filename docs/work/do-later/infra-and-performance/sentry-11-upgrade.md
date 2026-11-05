# Upgrade both apps to Sentry 11

**What:** Move monitoring-core and both apps from Sentry 10 to Sentry 11, keeping every telemetry guarantee.
**Severity:** low
**Came from:** the Q-Sports orchestrator session (audit stage), on DJ's word
**Trigger:** when DJ has time to work it through and test it

This is a write-up of the item as it is known now, not a finished design.

## Why

`npm audit` reports a moderate `glob` advisory (GHSA-3g3m-2fjr-6pw4) through `@sentry/nextjs`'s
build plugin (`@sentry/bundler-plugins`, `@sentry/webpack-plugin`): every 10.x, and 11.x through
11.10.0. The first fixed release is `@sentry/nextjs` 11.11.0. The advisory is build-time only (the
source-map upload), and the gate's audit, which fails on high, passes.

## What has to move

- `monitoring-core` declares `@sentry/nextjs` and `@sentry/node` `^10.32.1` (dev and optional
  peer); both go to 11.x, and both apps' installs follow, with each app's own `@sentry/nextjs`
  range.
- Sentry 11 changes the defaults the telemetry rules rely on (RULE-STD-QUALITY-102,
  RULE-STD-QUALITY-106), so each init — browser, Next server and edge, and Functions — is reworked
  and proved, not just reinstalled:
  - `sendDefaultPii` is removed; `dataCollection` replaces it and, unset, collects more than v10 did
    (user info, cookies, HTTP bodies, URL query parameters). Each init sets it so nothing beyond the
    content policy leaves.
  - Span streaming is the default: `beforeSendTransaction` and `ignoreTransactions` stop running,
    so an init that drops every transaction through `beforeSendTransaction` (the Next server inits
    and the Functions backend) needs the v11 way to send no trace at all.
  - Console breadcrumbs come from `consoleIntegration`, not `breadcrumbsIntegration`'s `console`
    option; `attachStacktrace` defaults to true; `InboundFilters` is renamed `EventFilters`;
    `@sentry/node-core` is merged into `@sentry/node`; tags and extras no longer apply to spans.
  - `withSentryConfig` stays on `@sentry/nextjs/config`; the build options both apps pass are checked
    against v11's removed and moved options.
- Sentry's own v10 to v11 migration guide (`MIGRATION.md` in the sentry-javascript repository) is
  read in full first.

## Done when

monitoring-core and both apps are on Sentry 11; each init's tests prove the content policy, the
scrubber on every event type, no request data, no breadcrumbs and no transactions or spans sent;
both apps' full Test Flows are green; a hosted dev error in Sentry still shows source lines; and the
`glob` advisory is gone from both apps' `npm audit`.
