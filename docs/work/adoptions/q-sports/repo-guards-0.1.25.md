# Adopt @ttt-productions/repo-guards 0.1.25

**What:** The `blanketCasts` guard also fails a cast over a value another cast reshaped.
**Severity:** high
**Came from:** the ttt-prod shared-standards Phase 3 repair session (sixth package release)

- **Package and version:** `@ttt-productions/repo-guards` 0.1.25.
- **Release:** `./scripts/release-multiple.sh dev-standards monitoring-core repo-guards patch`.
- **What changed:** "no cast switches type checking off" also flags a cast whose operand is another cast (`'x' as string as T`) or an object or array literal holding one (`{ type: 'x' as string } as T`, `{ ...(o as Record<string, unknown>) } as T`). Widening a value first and then asserting the real type is the same lie as `as unknown as`, in a shape the guard did not see before. `as const` is not a cast for this check.
- **What the app must change:** Install, then run the guard suite with `-t "no cast switches type checking off"`. Give each new finding its real type: drop a redundant cast, use a typed fixture builder, or read a raw document through its schema. A deliberately invalid input proving a runtime guard, where no real value can express the case, becomes a reviewed `blanketCasts` entry that anchors that cast and gives its reason — on DJ's yes.
- **Done when:** The lockfiles name 0.1.25 or later and the guard suite passes `blanketCasts`.
