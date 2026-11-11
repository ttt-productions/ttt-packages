# input-format-core 0.1.5: a US phone number format

**What:** `input-format-core` gains a phone number format: a US number held as its 10 digits and shown as `814-823-1858`.
**Severity:** low

- **Package and version:** `@ttt-productions/input-format-core` 0.1.5.
- **Release:** `./scripts/release-multiple.sh input-format-core ui-core q-core patch`.
- **What changed:** new exports only — `definePhoneFormat`, `readPhoneText`, `checkPhoneDigits`,
  `formatPhone`, `phoneTextMaxLength`, `PHONE_FORMATS`, `isPhoneFormat`, and their types
  (`docs/packages/input-format-core.md` § Owns — phone numbers). Nothing existing changed.
- **What the app must change:** the install. ttt-prod's one phone, the NCII take-it-down contact phone
  (`ttt-core` `schemas/ncii.ts`), is length-bounded free text and stays so: a person reporting may
  give a number outside the US, and the only phone format is `us`. Moving it onto a phone format is
  a decision for DJ, not part of this adoption.
- **Done when:** ttt-prod's lockfile names `@ttt-productions/input-format-core` 0.1.5 or later.
