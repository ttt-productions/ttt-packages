// Per-package configuration for the root runtime-leak audit (check #1).
//
// mode:
//   'hard'   — root MUST be free of client/runtime leaks. A leak fails the test.
//   'report' — root is being purified; leaks are printed but do not fail (yet).
//   'exempt' — package is intentionally a client/React or server-only surface
//              whose root is NOT claimed to be pure (skipped entirely).
//
// `allow` lists forbidden specifiers that are expected for a given root (none
// today — every audited root is expected fully clean).
//
// The whole suite can be forced into report-only mode for a full inventory
// sweep with BOUNDARY_REPORT_ONLY=1 (see root-runtime-leak.test.ts).

export type LeakMode = 'hard' | 'report' | 'exempt';

export interface PackageLeakRule {
  /** Folder under packages/, e.g. 'firebase-helpers'. */
  dir: string;
  mode: LeakMode;
  allow?: string[];
}

export const PACKAGE_LEAK_RULES: PackageLeakRule[] = [
  // Tier 0 generic foundations — server-safe roots.
  // firebase-helpers + auth-core were purified (Steps 1-2): client runtime moved
  // behind ./client + ./firestore-client, so their roots are now hard-fail.
  { dir: 'firebase-helpers', mode: 'hard' },
  { dir: 'auth-core', mode: 'hard' },
  { dir: 'chat-schemas', mode: 'hard' },
  { dir: 'media-schemas', mode: 'hard' },
  { dir: 'mobile-core', mode: 'hard' },
  { dir: 'monitoring-core', mode: 'hard' },
  { dir: 'query-core', mode: 'hard' },
  { dir: 'theme-core', mode: 'hard' },
  { dir: 'ui-core', mode: 'hard' },
  { dir: 'rate-limit-core', mode: 'hard' },
  { dir: 'audit-core', mode: 'hard' },
  { dir: 'moderation-core', mode: 'hard' },
  { dir: 'edge-protocol-core', mode: 'hard' },

  // Tier 1 — server-safe roots (React lives behind subpaths).
  { dir: 'file-input', mode: 'hard' },
  { dir: 'media-viewer', mode: 'hard' },
  { dir: 'notification-core', mode: 'hard' },
  { dir: 'report-core', mode: 'hard' },
  { dir: 'upload-core', mode: 'hard' },

  // Tier 2 / Tier 3.
  { dir: 'upload-ui', mode: 'hard' },
  { dir: 'chat-core', mode: 'hard' },

  // Application data — server-safe root.
  { dir: 'ttt-core', mode: 'hard' },

  // Intentionally server-only; root is not a browser-safe surface.
  { dir: 'media-processing-core', mode: 'exempt' },

  // Intentionally a React UI package — its root IS the chat React surface
  // (react/firebase/lucide), so it is not claimed pure and is not audited.
  { dir: 'chat-react', mode: 'exempt' },
];
