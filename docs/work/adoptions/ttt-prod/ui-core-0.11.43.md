# ui-core 0.11.43: a phone number box

**What:** `ui-core` gains `PhoneInput`, a box for a phone number declared with `input-format-core`'s phone format.
**Severity:** low
**Came from:** the Q-Sports package session that built Q-Sports' contact phone on it

- **Package and version:** `@ttt-productions/ui-core` 0.11.43.
- **Release:** `./scripts/release-multiple.sh input-format-core ui-core q-core patch`.
- **What changed:** a new `./react` export, `PhoneInput` / `PhoneInputProps`
  (`docs/packages/ui-core.md` § Phone input). Inside `format-control.ts`, the blur tidy's text
  replacement is one internal helper both boxes use; `Input` and `Textarea` behave as before.
- **What the app must change:** the install. ttt-prod has no field that uses a phone format.
- **Done when:** ttt-prod's lockfile names `@ttt-productions/ui-core` 0.11.43 or later.
