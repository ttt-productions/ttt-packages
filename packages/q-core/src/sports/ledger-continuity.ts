// Whether a game's event ledger holds exactly the sequences 1..n. `statEventSequence` is both the
// number of events and the last sequence given, so a gap or a duplicate is out-of-band damage: the
// check reports it, and finalize and the restore refuse it. The event documents are the source of
// truth (SPORT-101), so nothing renumbers them to close a gap.

/** The first place a ledger departs from 1..n: a sequence missing, or one held by two events. */
export type LedgerContinuityBreak =
  | { readonly kind: 'gap'; readonly missingSequence: number }
  | { readonly kind: 'duplicate'; readonly sequence: number };

/** `null` when the events hold exactly the sequences 1..n (an empty ledger included); otherwise the first break. */
export function findLedgerContinuityBreak(
  events: readonly { readonly sequence: number }[],
): LedgerContinuityBreak | null {
  const sequences = events.map((event) => event.sequence).sort((left, right) => left - right);
  for (let index = 0; index < sequences.length; index += 1) {
    const expected = index + 1;
    const sequence = sequences[index];
    if (sequence === expected) continue;
    if (index > 0 && sequence === sequences[index - 1]) return { kind: 'duplicate', sequence };
    return { kind: 'gap', missingSequence: expected };
  }
  return null;
}
