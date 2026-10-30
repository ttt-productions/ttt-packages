# @ttt-productions/input-format-core

The one input-format mechanism: every kind of value a person types into a box — text, money in whole cents,
and further kinds (numbers, decimals) as they are added — has its declaration of what the box
accepts, and the one check the box and every server bound both run.

## Owns — text formats

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
  as an inline literal where it is enforced (RULE-STD-ENG-005, RULE-STD-ARCH-102); `checkInputFormat` takes any spec.
- **The check** — `checkInputFormat(text, spec)` → `InputFormatResult`. It trims, then judges `min`,
  then `max`, then the format's characters, and stops at the first failure:
  - `min` is judged on the trimmed text: `min: 1` means the text cannot be blank, `min: 0` means it
    is optional.
  - Length is counted in UTF-16 code units — the unit a zod `.max()` and an HTML `maxLength` count.
  - Every judgment is made on the trimmed typed text, so a line break or a character the format
    refuses is refused before anything else happens to it.
  - The answer carries `value`, the text the field keeps: trimmed, and — for every format but `none`
    — with each run of whitespace held to one space after the checks pass, so `The  Dark Woods` is
    kept as `The Dark Woods`; or exactly as typed when the declaration sets `keepAsTyped`. Callers
    send and store `value`, never the raw text.
  - An accepted answer also carries `reformatted`: true when the kept value differs from the typed
    text by more than its ends, so a form can say the text will be tidied.
  - A failure carries `issue`: `tooShort`, `tooLong`, or `invalidCharacters`.
  - `keepAsTyped` keeps surrounding whitespace in the value and judges `max` and the characters on the
    text as typed; `min` is still judged on the trimmed text, so a required field is never blank
    (RULE-STD-ARCH-102). It is for fields whose words are kept verbatim.

The same function runs in the browser input and in every server parse, so the form, the wire, and the
writer accept exactly the same texts.

## Owns — money

Money is US dollars held as whole cents everywhere it is stored, sent, or checked; dollars exist only
in what a person types and what a screen shows.

- **A money declaration** — `MoneyFormatSpec`: `minCents` and `maxCents`. `defineMoneyFormat(spec)`
  returns it frozen as a `DeclaredMoneyFormat` and throws where it is written when it cannot be
  satisfied (a `minCents` that is not a whole number ≥ 0, a `maxCents` that is not a whole number ≥ 1
  and ≥ `minCents`). A money box takes only that type.
- **The digit limits** — `moneyDigitLimits(spec)` → `{ dollarDigits, centDigits }`, counted from
  `maxCents`: the dollar digits of the largest amount, plus two cent digits. A `$`, a comma, or the
  point is never counted, so a $500,000.00 maximum allows 6 dollar digits and 2 cent digits.
- **Reading typed text** — `readMoneyText(text, spec)` → `MoneyTextResult`. It ignores surrounding
  space, one leading `$`, and commas; accepts digits with at most one point; and turns the text into
  whole cents by splitting at the point, never by multiplying a decimal by 100, so `0.29` is exactly
  29 cents. An empty box, or one holding only `$` or `.`, reads as `cents: null`. It refuses with
  `invalidCharacters`, `tooManyDollarDigits` (leading zeros are not counted), or
  `tooManyCentDigits`. It does not judge the amount: text within the digit limits can still be over
  `maxCents`.
- **Checking an amount** — `checkMoneyCents(cents, spec)` → `MoneyAmountResult`: `notWholeCents`
  (a fraction of a cent, `NaN`, or an infinity), `tooSmall`, or `tooLarge`. The box and every server
  parse run it, so they accept exactly the same amounts.
- **Box text for a stored amount** — `moneyTextFromCents(cents)` writes `1000.50`: dollars, the point,
  two cent digits, with no `$` or commas, and `readMoneyText` reads it back to the same cents.
- **Showing an amount** — `formatMoney(cents, style)`, the one money formatter: `cents` (the default,
  `$1,000.50`), `wholeDollars` (rounded, `$1,001`), or `compact` (`$2.5K`).

## Boundary

- No dependencies, no React, no zod; the root is server-safe (the boundary suite holds it `hard`).
- It declares no field. Which format and bounds a field uses is the consumer's declaration — an
  application's field table, or a generic package's own contract (a chat message's bound lives in
  `chat-schemas`). A generic package that renders a text input takes the declaration from its consumer
  wherever the bound is application policy (RULE-STD-ARCH-201).
- It builds no schema. A consumer that validates with zod wraps `checkInputFormat` and
  `checkMoneyCents` in its own schema builders, so there is one zod builder per application rather than one per package.
- It carries no user-facing copy: an `issue` is a code, and the words shown for it belong to the app.
- Not a profanity or content filter, and not a format for passwords, emails, phone numbers, web
  addresses, search queries, files, or colours — those inputs keep the browser's own formats. A kind
  of value it does not declare yet (a plain number, a decimal) joins as its own declaration and check
  here, never as a second mechanism elsewhere.
