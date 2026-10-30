# Adopt @ttt-productions/input-format-core 0.1.4

**What:** input-format-core now holds money as well as text: a money declaration in whole cents, its digit limits and checks, and the one money formatter.
**Severity:** low
**Came from:** the ttt-packages money-format session (ttt-prod scope)

- **Package and version:** `@ttt-productions/input-format-core` 0.1.4.
- **Release:** `./scripts/release-multiple.sh input-format-core ui-core ttt-core patch`.
- **What changed:** Additive. `defineMoneyFormat({ minCents, maxCents })` declares a money field held as whole cents; `moneyDigitLimits` counts the dollar and cent digits a box allows from the maximum (a `$`, comma, or point never counts); `readMoneyText` turns typed dollars into whole cents without decimal math; `checkMoneyCents` judges an amount against the declaration; `moneyTextFromCents` writes a stored amount back into a box; `formatMoney(cents, 'cents' | 'wholeDollars' | 'compact')` is the one way to show money. The text-format API is unchanged.
- **What the app must change:** Install `@ttt-productions/input-format-core@latest` wherever it is declared. Then check Q-Sports for money it stores, sends, types, or shows: each amount should be stored as whole cents, declared once in q-core with `defineMoneyFormat`, judged on the server through `checkMoneyCents`, typed through ui-core's `MoneyInput`, and shown through `formatMoney` rather than a local `Intl.NumberFormat` or `toFixed`. With no money in Q-Sports, the install is the whole adoption.
- **Done when:** The lockfiles name `@ttt-productions/input-format-core` 0.1.4 or later, any money in Q-Sports follows the bullet above, and the gate is green.
