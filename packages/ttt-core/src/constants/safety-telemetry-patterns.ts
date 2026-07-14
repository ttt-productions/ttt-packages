// ============================================================================
// SAFETY TELEMETRY FORBIDDEN PATTERNS — the ONE declaration of the TTT-specific
// forbidden-pattern set for the CSAM/NCII subsystem, injected into every
// `createTelemetryScrubber({ patterns })` call (frontend client + nodejs/edge
// inits AND the backend Sentry init). Consolidated here 2026-07-13 from the
// former duplicate pair (functions/src/shared/safety-telemetry.ts ↔
// src/lib/safety-telemetry-patterns.ts). Deliberately dependency-free: entries
// are `RegExp | string`, structurally identical to monitoring-core's
// `ForbiddenPattern`, so ttt-core needs no monitoring-core dependency.
//
// The patterns are SPECIFIC (→ low collateral on ordinary errors) and reference
// the real storage prefixes + default project bucket hostnames used by the app:
//   - `nciiEvidence/`, `nciiAuthorityEvidence/` (public evidence key prefixes),
//   - `evidence/` (the SAFETY_EVIDENCE_BUCKET vault key prefix),
//   - the dev + prod default Firebase Storage buckets plus the legacy
//     `.appspot.com` form and the raw `storage.googleapis.com` object host.
// Merged AFTER monitoring-core's generic DEFAULT_FORBIDDEN_PATTERNS (IPs,
// bearer/authorization tokens, credential assignments) at every injection site.
// ============================================================================

/** The dev + prod default Firebase Storage bucket hostnames (apphosting*.yaml). */
export const EVIDENCE_BUCKET_HOSTS = [
  'ttt-dev-cfb70.firebasestorage.app',
  'ttt-prod-cfaf3.firebasestorage.app',
  'ttt-dev-cfb70.appspot.com',
  'ttt-prod-cfaf3.appspot.com',
] as const;

/**
 * TTT-specific forbidden patterns for the telemetry scrubber. `string` entries are
 * treated as literals by monitoring-core (no escaping needed); `RegExp` entries are
 * matched globally against every string in the event.
 */
export const TTT_FORBIDDEN_TELEMETRY_PATTERNS: (RegExp | string)[] = [
  // --- Evidence-bucket URL prefixes (dev + prod), any evidence/authority-proof key. ---
  // A fully-qualified evidence object URL: <host>/<...>/nciiEvidence/... etc.
  ...EVIDENCE_BUCKET_HOSTS.map(
    (host) =>
      new RegExp(
        `https?://[^\\s"']*${host.replace(/\./g, '\\.')}[^\\s"']*`,
        'gi',
      ),
  ),
  // The raw GCS object host, regardless of bucket (catches storage.googleapis.com URLs).
  /https?:\/\/(?:storage\.googleapis\.com|firebasestorage\.googleapis\.com)\/[^\s"']*/gi,

  // --- Evidence storage KEY prefixes (bare object paths, no host). ---
  // nciiEvidence/{requestReference}/{fileId}, nciiAuthorityEvidence/{reservationKey}/{fileId},
  // and the vault key prefix evidence/{caseId}/{digest}. Match the prefix + the rest of the path.
  /\bnciiEvidence\/[^\s"']+/gi,
  /\bnciiAuthorityEvidence\/[^\s"']+/gi,
  /\bevidence\/[a-zA-Z0-9._-]+\/[a-f0-9]{16,}[^\s"']*/gi,

  // --- PhotoDNA detector-hash shape: a 64-hex string (sha256 / detector hash). ---
  /\b[a-f0-9]{64}\b/gi,

  // --- NCMEC credential markers. ---
  // The PhotoDNA subscription-key header value + any NCMEC-credential-style assignment.
  /Ocp-Apim-Subscription-Key\s*[:=]\s*[^\s"']+/gi,
  /\bncmec[_-]?(?:api[_-]?key|secret|password|credential|token)\b\s*[:=]?\s*[^\s"']*/gi,
];
