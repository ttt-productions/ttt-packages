# `@ttt-productions/email-core` — Design Doc

**Area:** infra-and-performance · **Priority:** P1 · **Effort:** L
**Trigger:** first transactional-email need (receipts, notifications, admin broadcast by email).

## Overview

**Status:** proposed (not built)

A provider-agnostic email-sending layer, to be packaged in `ttt-packages`, that lets any consumer app send transactional, digest, marketing, and admin-broadcast emails through one swappable interface. Nothing here exists yet: there is no `email-core` package, no email types in `ttt-core`, and no email worker/callable in `ttt-prod/functions`. This is the design to build against.

The core promise: **a consumer app calls one function to enqueue an email; the package handles provider selection, retries, and delivery; swapping providers is a one-line config change.**

---

## Goals & non-goals

### Goals
- Single enqueue surface for all sends (transactional, digest, marketing, broadcast).
- Provider adapter pattern — swap Resend for Postmark for SES with zero call-site changes.
- React Email templates, authored per-app.
- Firestore outbox for durability and retry.
- Separate broadcast path for admin mass sends, so they don't clog the main outbox.
- Auth-gated entry: backend events and admin only, never direct user calls.

### Non-goals (this design)
- User email preferences / unsubscribe (deferred — every send goes through for now).
- Rate limiting / abuse prevention at this layer (deferred — trust the event triggers).
- Inbound email / reply parsing — out of scope.
- Email analytics dashboards — provider dashboards suffice for now.
- Frontend-direct sends — users never touch this layer.

---

## High-level architecture

```
Consumer app (ttt-prod)               @ttt-productions/email-core            Firestore                 App functions/            Provider
  CF trigger / admin callable / ─────▶  types · enqueue helpers ·   ─writes─▶  emailOutbox/{id}  ─onCreate─▶ outbox worker fn  ─HTTP─▶ Resend /
  event publisher                        adapter iface · Resend              emailBroadcasts/{id}          broadcast worker fn        Postmark /
   enqueueEmail() / enqueueBroadcast()   adapter · worker core logic         …/recipients/{uid}           templates + registry        SES
```

**One-sentence data flow:** consumer calls `enqueueEmail()` → an outbox doc is written → a worker triggers on create → it renders the template and calls the provider adapter → it updates the outbox doc with the result.

---

## Package boundary

**In `@ttt-productions/email-core` (shared, brand-agnostic plumbing):**
- **Types** — outbox doc, broadcast doc, adapter contract, send result, category/status enums, the template-registry *type* each app supplies.
- **Enqueue helpers** — `enqueueEmail()`, `enqueueBroadcast()`: pure functions that validate input and write to Firestore.
- **Provider adapter interface** + implementations (`ResendAdapter` first; `PostmarkAdapter`/`SesAdapter` later).
- **Worker core logic** — `processOutboxDoc()`, `processBroadcastDoc()`, retry sweep: pure functions taking a doc + the app's template registry + an adapter, returning a result. No Cloud Functions wrapping here.
- **Firestore path constants.**

**In each consumer app (e.g. `ttt-prod/functions/`):**
- **Template files** (`.tsx`, React Email) using app-specific branding/voice/terminology.
- **Template registry** mapping template keys to components + a data shape.
- **Cloud Function wrappers** (`onDocumentCreated` / `onDocumentUpdated`) that call the email-core core logic with the app's registry + configured adapter.
- **Admin callable** (`sendAdminEmail`) calling the enqueue helpers.
- **Event publishers** — each domain event (work approved, user invited, artisan creator accepted, …) calls `enqueueEmail()` with the right template key.

**Why split this way:** templates are brand-specific (TTT says "Charter Member", "Bouquet") so they'd couple all brands if shared; plumbing (retry a failed send) is identical everywhere; and CF *handlers* must live in each app's `functions/` because that's where its deploy pipeline runs — only the *logic inside* them is imported. This mirrors `notification-core` and `chat-core` in `ttt-packages`.

---

## Data model

Three Firestore shapes. Timestamps are `number` (ms, `Date.now()`), per ttt-prod convention.

### `emailOutbox/{outboxId}` — one doc per single send (one recipient, one template)
- **Identity:** id; optional caller-supplied `idempotencyKey`.
- **Source:** `category` (`transactional` | `digest` | `marketing`), `sourceApp`, optional `sourceEvent`, `triggeredBy` (`system` | `admin` | `backend-event`, with admin uid when manual).
- **Content:** `templateKey`, `templateData`, `subject`, optional `fromOverride`. `subject` is rendered at enqueue time so it's queryable in the console; the **HTML body is not** — it's rendered at send time (see "Render timing").
- **Recipient:** `toEmail`, optional `toUserId` / `toName`.
- **Lifecycle:** `status` (`pending` | `sending` | `sent` | `failed` | `deadLetter`), `attemptCount`, `maxAttempts` (default 5), optional `nextAttemptAt` (backoff), `createdAt`/`updatedAt`/`sentAt`.
- **Result:** optional `providerMessageId`, `lastError` (`{ message, code?, at }`), `providerName`.

`deadLetter` = max attempts reached, manual intervention needed.

### `emailBroadcasts/{broadcastId}` — one doc per admin broadcast (intent + metadata, not the recipient list)
- `status` (`pending` | `fanningOut` | `sending` | `completed` | `failed` | `cancelled`).
- Content: `templateKey`, `templateData`, `subject`, optional `fromOverride`, `category` (`digest` | `marketing` — broadcasts are never transactional).
- Targeting: `recipientQuery` (`all-users` | `user-ids` | `role` | `custom`, with the relevant ids/role/filter).
- Progress: optional `totalRecipients` (after fan-out), `sentCount`, `failedCount`.
- Lifecycle: `createdBy` (admin uid), `createdAt`, optional `startedAt`/`completedAt`.
- Safety: optional `scheduledFor` (deferred, not v1), `cancellable`.

### `emailBroadcasts/{broadcastId}/recipients/{userId}` — one doc per broadcast recipient
`broadcastId`, `userId`, `toEmail`, optional `toName`; `status` (`pending` | `sent` | `failed` | `skipped`), `attemptCount`, optional `sentAt`/`providerMessageId`/`lastError`.

**Why a subcollection rather than a flat global targets collection:** "all recipients for broadcast X" is one scoped query, and historical broadcasts don't pile millions of docs into a single global collection. Matches the existing TTT pattern for nested per-parent data.

---

## Public surface (what callers use)

Two functions, both imported from `@ttt-productions/email-core/server` (server-only — Node imports gate them off the client).

- **`enqueueEmail(params) → { outboxId }`** — single send. Takes the recipient (`toEmail`, optional `toUserId`/`toName`), content (`templateKey`, `templateData`, `subject`, optional `fromOverride`), metadata (`category`, `sourceApp`, optional `sourceEvent`, `triggeredBy`, optional `idempotencyKey`), and optional `maxAttempts`. Returns as soon as the outbox doc is written; it does **not** send — the worker does.
- **`enqueueBroadcast(params) → { broadcastId }`** — admin mass send. Takes content + `category` + a `recipientQuery` + `createdBy`. Writes the broadcast doc; a fan-out worker expands the query into the `recipients/` subcollection, then per-recipient workers send each email.

---

## Template registry (app-side)

Each consumer app defines its own registry mapping template keys → `{ component, defaultSubject }`, and derives a `TemplateKey` union from it (`keyof typeof registry`). The worker imports the registry and passes it into `processOutboxDoc()`.

Call sites reference templates by **key + data** (registry-driven) — type-safe when `templateKey` is typed to the app's key union, and preferred for automated event triggers:

```ts
await enqueueEmail({ templateKey: 'projectApproved', templateData: { … }, /* … */ });
```

A direct-component path (`enqueueEmailRaw` with a JSX component, rendered at enqueue time) is a **possible future** for one-off admin sends, but trades away re-render-on-retry. **v1 is registry-only.**

---

## Render timing: at send time

The worker, on picking up an outbox doc: loads the component from the app's registry by `templateKey`; validates `templateData` (future: a per-template zod schema); renders to HTML via `@react-email/render`; sends through the adapter.

**Why send-time:** fixing a buggy template needs no replay of enqueued docs (the next retry uses the corrected template); outbox docs stay small (key + data, not full HTML); any historical send can be re-rendered from its archived `templateKey` + `templateData`. Render cost is ms-level — negligible in a Cloud Function. **Tradeoff:** a template deleted/renamed between enqueue and send breaks the send — so treat the registry as **append-only** (deprecate, never delete).

---

## Provider adapter interface

An adapter has a `name` (`resend` | `postmark` | `ses`) and a single `send(params)` method taking `{ from, to, subject, html, text?, idempotencyKey?, tags? }` and returning either `{ ok: true, providerMessageId }` or `{ ok: false, error: { message, code?, retryable } }`. The adapter decides `retryable` from the provider's response.

**v1 — `ResendAdapter`:** takes its API key from the consuming app (which holds it in its own secret store), wraps Resend's `emails.send()`, and maps 5xx / rate-limit responses to `retryable: true`, validation errors to `false`.

**Swap flow (e.g. to Postmark):** implement `PostmarkAdapter`; change the adapter constructor in each app's worker; rotate the API-key secret; deploy. No call-site, template, or schema changes.

---

## Cloud Function handlers (per app)

Thin wrappers, deployed in each app's functions bundle; all real logic is imported from email-core:

- **Outbox worker** — `onDocumentCreated('emailOutbox/{id}')` → `processOutboxDoc({ docRef, docData, templates, adapter, defaultFrom })`.
- **Retry sweep** — `onSchedule('every 5 minutes')` → reprocess outbox docs with `status === 'pending'` and `nextAttemptAt <= now`.
- **Broadcast fan-out** — `onDocumentCreated('emailBroadcasts/{id}')` → expand `recipientQuery` into recipient docs. The query→recipients resolver is **app-specific** (user data lives in each app's Firestore) — this is the one place app logic enters the worker layer.
- **Broadcast recipient worker** — `onDocumentCreated('emailBroadcasts/{id}/recipients/{uid}')` → send that one email.

---

## Auth model

A three-way split; users never call email-core directly.

1. **Backend-event triggers (automated)** — no auth; they run inside Cloud Functions with the Admin SDK and import the enqueue helpers directly. Example: an `onWorkStatusChange` trigger detecting `approved` calls `enqueueEmail({ templateKey: 'projectApproved', … })`.
2. **Admin callable (manual)** — a `sendAdminEmail` callable verifies the admin custom claim (and App Check), then calls an enqueue helper. This is a **sensitive action** (admin mass-mail): on success it must write an audit event per `docs/design/audit-events-and-actor-context.md`, with a `{ result: 'failure' }` event on rejected attempts.
3. **Internal backend-to-backend HTTP** — not needed for v1; only required if a *different* backend service outside this monorepo must trigger sends.

When a user action should email someone (e.g. a chat message notifies the recipient), the **backend event handler** for that action calls `enqueueEmail()` — the user's frontend never touches the email layer. This is enforced architecturally: the helpers are only exported from `@ttt-productions/email-core/server`, gated behind Node-only imports.

---

## Lifecycle & retry

`pending → sending →` then either `sent`, or on error: retryable → set `nextAttemptAt`, back to `pending`; non-retryable → `failed`; out of attempts → `deadLetter`.

- **Backoff:** exponential, capped — `nextAttemptAt = now + min(2^attemptCount · 60s, 1h)`. On `deadLetter`, fire Sentry.
- **Idempotency:** when `idempotencyKey` is set, the enqueue helper checks for an existing outbox doc with that key before writing — prevents duplicate sends when a trigger fires twice.

---

## Observability, secrets & placement

- **Sentry:** every transition to `failed`/`deadLetter` captures `outboxId`, `templateKey`, `providerName`, `attemptCount`, `lastError`.
- **Firestore indexes:** `status + nextAttemptAt` (retry sweep), `status + createdAt` (admin dashboard), `toUserId + createdAt` (per-user history).
- **Secrets/config:** the provider API key and the default from-name/address are the consuming app's, passed in; adapter selection is per app for v1 (an app-config switch only if hot-swapping is ever needed).
- **Tier placement:** `email-core` depends on `firebase-admin` (peer), `@react-email/render`, and `resend` (v1; demote to optional/peer once more adapters land) — **no internal `@ttt-productions/*` deps**. It sits near the bottom of the tier graph, a sibling of `firebase-helpers`, and notably **not** a child of `notification-core`: in-app notifications and email are separate surfaces that often fire on the same event, with the domain event handler calling each independently.

---

## Design decisions

1. **Plain-text fallback** — auto-generated from HTML via `@react-email/render`'s `text` option; templates do not need to export a separate `<Text>` component.
2. **Template schema validation** — per-template Zod schemas validated at enqueue time are desirable; not required for the initial build.
3. **Broadcast cancellation** — `cancellable` is a status field for now; the active cancel path is deferred.
4. **Dry-run adapter** — a `DryRunAdapter` that logs instead of sending (toggle via `EMAIL_DRY_RUN=true`) ships with the package for E2E testing.

---

## Deferred

User email preferences (`publicUsers.emailPreferences`) + unsubscribe; rate limiting / per-recipient caps; per-template "once ever per user" idempotency; a second adapter (Postmark) to prove the swap; an admin dashboard for sends/failures/retry; the raw-component send path; scheduled broadcasts (`scheduledFor`); inbound/reply parsing; per-template zod validation; analytics beyond the provider dashboard.
