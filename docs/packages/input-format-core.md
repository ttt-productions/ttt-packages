# @ttt-productions/input-format-core

The one text-format mechanism: the named input formats, the declaration of a text field's format, min,
and max, and the one check every text input and every server bound runs.

## Owns

- **The named formats** (`InputFormat`, listed by `INPUT_FORMATS`, recognised by `isInputFormat`). Each
  format's allowed characters are written once, inside the package:
  - `englishNormal` — English letters `A–Z a–z`, digits `0–9`, and the space (U+0020); one line.
  - `englishNormalNoSpaces` — English letters and digits only.
  - `englishLettersOnly` — English letters only.
  - `singleLine` — any character except a line break (CR, LF, U+2028, U+2029).
  - `none` — any character, line breaks included.
- **A field declaration** — `InputFormatSpec`: `format`, `min`, `max`, and the optional `keepAsTyped`.
  `defineInputFormat(spec)` returns the declaration frozen, keeping its literal values, and throws where
  it is written when it cannot be satisfied (an unknown format, a `min` that is not a whole number ≥ 0,
  a `max` that is not a whole number ≥ 1 and ≥ `min`). What it returns is a `DeclaredInputFormat` — a
  type only `defineInputFormat` produces. Inputs that render a field (ui-core's `Input` / `Textarea`,
  ConsequenceDialog's reason, report-core's comment) take only that type, so a bound is never written
  as an inline literal where it is enforced (ENG-005, ARCH-102); `checkInputFormat` takes any spec.
- **The check** — `checkInputFormat(text, spec)` → `InputFormatResult`. It trims, then judges `min`,
  then `max`, then the format's characters, and stops at the first failure:
  - `min` is judged on the trimmed text: `min: 1` means the text cannot be blank, `min: 0` means it
    is optional.
  - Length is counted in UTF-16 code units — the unit a zod `.max()` and an HTML `maxLength` count.
  - The answer carries `value`, the text the field keeps: trimmed, or exactly as typed when the
    declaration sets `keepAsTyped`. Callers send and store `value`, never the raw text.
  - A failure carries `issue`: `tooShort`, `tooLong`, or `invalidCharacters`.
  - `keepAsTyped` keeps surrounding whitespace in the value and judges `max` and the characters on the
    text as typed; `min` is still judged on the trimmed text, so a required field is never blank
    (ARCH-102). It is for fields whose words are kept verbatim.

The same function runs in the browser input and in every server parse, so the form, the wire, and the
writer accept exactly the same texts.

## Boundary

- No dependencies, no React, no zod; the root is server-safe (the boundary suite holds it `hard`).
- It declares no field. Which format, min, and max a field uses is the consumer's declaration — an
  application's field table, or a generic package's own contract (a chat message's bound lives in
  `chat-schemas`). A generic package that renders a text input takes the declaration from its consumer
  wherever the bound is application policy (ARCH-201).
- It builds no schema. A consumer that validates with zod wraps `checkInputFormat` in its own schema
  builder, so there is one zod builder per application rather than one per package.
- It carries no user-facing copy: an `issue` is a code, and the words shown for it belong to the app.
- Not a profanity or content filter, and not a format for passwords, emails, numbers, phone numbers,
  web addresses, search queries, files, or colours — those inputs keep the browser's own formats.
