# A guard against two Escape presses in a row in an E2E spec

**What:** A check that fails when an E2E spec or helper presses Escape twice with no wait for the first layer to close in between.
**Severity:** low
**Trigger:** when DJ has time for the nice-to-have guards

This is a write-up of the item as it is known now, not a finished design.

## The gap

A Radix Select opened inside a Dialog puts two layers on the page, and each Escape closes only the
top one. A spec that closes both with two presses back to back races the first close: the second
press can land while the Select's list is still on its way out, the list swallows it, and the
dialog stays open. The test then passes only on a retry, which the gate counts as a failure
(RULE-STD-QUALITY-003).

It turned up in Q-Sports' local E2E on 2026-11-10, as a retry-pass in `e2e/admin/free-agents.spec.ts`
(`expectJoinOffers`), and the same two lines were in `e2e/teams/team-joining.spec.ts`
(`expectOfferedToJoin`). Both now wait for the list to be gone before the second press:

```ts
await person.keyboard.press('Escape');
await expect(person.getByRole('listbox')).toHaveCount(0);
await person.keyboard.press('Escape');
await expect(dialog).toBeHidden();
```

Q-Sports' E2E trees hold 71 Escape presses in 29 files, and after the two fixes none is followed
directly by another. Nothing stops the pair coming back; today only a retry-pass catches it, and
only on the run where the race is lost. ttt-prod's trees have not been checked.

## Fix shape (not decided)

A static check over an app's E2E trees (`e2e/**`, `e2e-hosted-dev/**`, and the shared E2E foundation
once it is a package): a `press('Escape')` whose next statement, comments aside, is another
`press('Escape')` fails, naming the file and line and the wait to put between them. Any awaited
assertion or wait between the two passes; the check does not judge whether it is the right one.

Open points for the design:

- Whether it reads statements through the TypeScript parser or line by line. A parser sees a pair
  split across a helper call's arguments or a loop; a line scan does not.
- Whether a loop that presses Escape each pass (`for … press('Escape')`) is the same defect and
  fails too.
- Whether the same race exists for other keys that close one layer at a time, so the check takes a
  list of keys rather than Escape alone.

A generic repo-guards check (packages-side), adopted by each app through its guard config, with its
own tests (a planted back-to-back pair fails, a pair with a wait between passes).

## Done when

The check exists in repo-guards with its own tests, each app registers it, and no E2E file in either
app presses Escape twice in a row.
