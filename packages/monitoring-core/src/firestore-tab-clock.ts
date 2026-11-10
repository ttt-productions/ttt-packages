// Firestore's multi-tab persistence compares a `Date.now()` another tab stored against its own and
// logs this line through console.error when the stored one is ahead; two tabs reading one instant
// 1 ms apart is clock rounding, and the next lease renewal passes. A wider gap is a real clock
// disagreement.
const FIRESTORE_TAB_CLOCK_LINE =
  /@firebase\/firestore: Firestore \([\d.]+\): Detected an update time that is in the future: (\d+) > (\d+)$/;
const FIRESTORE_TAB_CLOCK_MAX_GAP_MS = 1;

export function isFirestoreTabClockRoundingLine(text: string): boolean {
  const match = FIRESTORE_TAB_CLOCK_LINE.exec(text);
  if (!match) return false;
  const gap = Number(match[1]) - Number(match[2]);
  return gap > 0 && gap <= FIRESTORE_TAB_CLOCK_MAX_GAP_MS;
}
