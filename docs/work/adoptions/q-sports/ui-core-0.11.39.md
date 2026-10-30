# Adopt @ttt-productions/ui-core 0.11.39

**What:** ui-core gains `MoneyInput`, the box for a money amount, which takes a money declaration and holds whole cents.
**Severity:** low
**Came from:** the ttt-packages money-format session (ttt-prod scope)

- **Package and version:** `@ttt-productions/ui-core` 0.11.39.
- **Release:** `./scripts/release-multiple.sh input-format-core ui-core ttt-core patch`.
- **What changed:** Additive. `./react` exports `MoneyInput` (`MoneyInputProps`): it takes a `DeclaredMoneyFormat` (`moneyFormat`), shows `cents` as dollars, hands every accepted edit to `onCentsChange` as whole cents (or `null` when empty), refuses any edit past the declaration's digit limits (a `$`, comma, or point never counts), and marks an amount over the maximum `aria-invalid`. Nothing existing changes.
- **What the app must change:** Install `@ttt-productions/ui-core@latest` wherever it is declared. Any box in Q-Sports where a person types money moves to `MoneyInput` with its q-core money declaration (see the input-format-core 0.1.4 adoption file); with no such box, the install is the whole adoption.
- **Done when:** The lockfiles name `@ttt-productions/ui-core` 0.11.39 or later, every money box uses `MoneyInput`, and the gate is green.
