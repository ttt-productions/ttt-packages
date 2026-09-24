# Pending package work — Q-Sports 2.0 conversion

The one list of `@ttt-productions/*` changes the Q-Sports 2.0 conversion needs and has not built yet.
It holds only remaining work: an entry is deleted once its package change is published, installed in
Q-Sports, and every Q-Sports spot it skipped has been built.

## How the list works

- **Conversion never stops at a package need.** When a piece of Q-Sports work needs a change in
  `ttt-packages`, the agent does not build that piece — never against unpublished package code, and
  never through an app-side shim. It adds an entry here and keeps converting everything else.
- **`q-core` never appears here.** It lives in the Q-Sports repo during the conversion and is changed
  directly by the unit that needs it.
- **The batch.** DJ and the orchestrator decide together when to run it — there is no fixed count;
  a batch may be three entries or nine, and a blocking entry may be cleared on its own. When a batch
  runs, Q-Sports work pauses: one agent does every entry in it in `ttt-packages` against that repo's
  `CLAUDE.md` and gate, DJ publishes and installs, agents build every skipped Q-Sports spot, the
  entries are deleted, and conversion continues.
- **ttt-prod adoption is DJ's.** When a batch publishes, DJ runs a ttt-prod conversation to adopt the
  changed packages. This list says how Q-Sports adopts, not ttt-prod.

## Entry format

Each entry is one `###` heading naming the change, then:

- **Packages:** the package folders it touches.
- **What changes and why:** the package-side change and the Q-Sports need that forced it.
- **Skipped in Q-Sports:** every spot not built because of it — unit, file or step doc, and what is
  missing there.
- **How Q-Sports adopts:** what gets built at each skipped spot once the change is installed.

## Entries

### A copy that can't clobber an existing destination

- **Packages:** `media-processing-core`.
- **What changes and why:** `MediaObjectStore.copy({ fromKey, toKey })` has no destination
  precondition, and on a failed copy it deletes the file it was writing. When two identical
  signing calls race, the losing call can delete the destination the winner's record already
  points to. The copy should take an if-absent precondition (`ifGenerationMatch: 0`) and never
  delete a destination it did not create.
- **Skipped in Q-Sports:** the waiver and hardware signing paths (Units 5 and 12) and
  `promoteStagedSignature` in `UPLOADS_AND_MEDIA.md` § Signatures are not built until this change
  is published and installed.
- **How Q-Sports adopts:** the signing cores pass the if-absent option, and a losing call reads the
  winner's record and acknowledges it.
