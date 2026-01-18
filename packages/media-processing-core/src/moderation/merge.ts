import type { MediaModerationResult } from "@ttt-productions/media-contracts";

export function mergeModeration(
  input?: MediaModerationResult | null,
  output?: MediaModerationResult | null
): MediaModerationResult | undefined {
  const a = input ?? undefined;
  const b = output ?? undefined;

  if (!a && !b) return undefined;
  if (!a) return b ?? undefined;
  if (!b) return a ?? undefined;

  // worst status wins: rejected > flagged > error > passed
  const rank = (s: string) =>
    s === "rejected" ? 4 : s === "flagged" ? 3 : s === "error" ? 2 : 1;

  const status = rank(a.status) >= rank(b.status) ? a.status : b.status;

  const reasons = Array.from(new Set([...(a.reasons ?? []), ...(b.reasons ?? [])]));
  const findings = [...(a.findings ?? []), ...(b.findings ?? [])];

  return {
    status,
    provider: b.provider ?? a.provider,
    reasons: reasons.length ? reasons : undefined,
    findings: findings.length ? findings : undefined,
    reviewedAt: b.reviewedAt ?? a.reviewedAt,
  };
}
