# A guard against untyped spies in typed module mocks

**What:** A repo-guards check that fails a module mock whose override is a bare `vi.fn()` — typed `any`, so the type checker compares nothing.
**Severity:** low
**Came from:** the ttt-packages shared-standards Phase 3 repair session (ttt-prod scope), while converting ttt-packages' tests for the `typedMocks` guard
**Trigger:** after launch, when DJ turns to improving the test code

This is a write-up of the item as it is known now — not a full design and not a finished one. The
counts and the fix shapes below come from one scan and one session's reasoning; the work that
picks this up designs it properly first.

## The gap

`typedMocks` (repo-guards, `src/modules/repo/typed-mocks.ts`) requires every `vi.mock` / `vi.doMock`
factory to return through a shared fake or a typed mock helper (`stubModule`, `passThroughModule`,
`clientFirestoreFake` in ttt-packages; `passThroughFake` and the shared fakes in ttt-prod), so each
override is compared to the real export it replaces. A bare `vi.fn()` — no type argument, no
implementation — is typed `(...args: any[]) => any`, which TypeScript accepts in place of any
function. The guard passes and nothing about the override is checked. The same holds for a spy
declared elsewhere as a bare `vi.fn()` and handed in by name (`getDocs: getDocsMock`).

A bare spy that is never given behavior only returns `undefined`, as before, so it cannot make a test
pass on wrong behavior by itself. The real risk is a bare spy a test later configures
(`mockReturnValue`, `mockResolvedValue`, `mockImplementation`): that value is never checked against
the real function's type. A test that reaches the spy through `vi.mocked(fn)` already gets the real
type, so not every flagged place carries risk.

## Size, from one scan

A scan of every module-mock factory in both repos found bare-`vi.fn()` overrides at:

- ttt-packages: 45 places in 10 files — 30 of them the global Firebase stubs in `test/setup.ts`.
- ttt-prod: 1,116 places — 547 in `src` (180 files) and 569 in `functions/src` (206 files). Many sit
  in factories that are not typed yet at all; round 1's rework and waves W7–W33 of the Phase 3 repair
  touch those files anyway.

These numbers move as the Phase 3 conversions land; recount when the item is picked up.

## The catch that sets the cost

Not every flagged spy can simply be typed. Vitest's spy type cannot match an overloaded or generic
signature, so a spy standing in for most of the Firestore SDK (`getDoc`, `getDocs`, `onSnapshot`,
`doc`, `collection`, `query`), `spawn`, or `httpsCallable` needs a real-SDK form instead — the
in-memory Firestore kits in `firebase-helpers`, a typed one-signature port, a fake server — or an
exception DJ approves. That is the expensive part, and it starts with `test/setup.ts`'s global stubs.

## Fix shapes considered (not decided)

- **Full:** fail every bare `vi.fn()` override in a module mock, with reviewed entries for the ones
  that cannot be typed.
- **Narrow:** fail only a bare spy that is later given behavior (a `mock…` call on it), since that is
  where a wrong shape can hide. Likely a small fraction of the places above; not counted.

Either is a generic repo-guards check (packages-side), adopted by each app through its guard config,
with the app's flagged places fixed in the same adoption.

## Done when

The chosen check is in repo-guards with its own tests, ttt-packages' boundary suite and each app's
guard suite register it, and every place it flags is typed, moved onto a real-SDK form, or carries a
reviewed entry DJ approved.
