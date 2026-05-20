/**
 * Compact number formatter:
 *   < 10,000 → "1234"
 *   10,000 ≤ n < 1,000,000 → "12.3k" (trailing ".0" stripped)
 *   ≥ 1,000,000 → "1.2M" (trailing ".0" stripped)
 */
export function formatLargeNumber(num: number): string {
  if (num >= 1_000_000) {
    const formatted = (num / 1_000_000).toFixed(1);
    return (formatted.endsWith(".0") ? formatted.slice(0, -2) : formatted) + "M";
  }
  if (num >= 10_000) {
    const formatted = (num / 1000).toFixed(1);
    return (formatted.endsWith(".0") ? formatted.slice(0, -2) : formatted) + "k";
  }
  return num.toString();
}
