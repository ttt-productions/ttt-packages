/** Google-style likelihood enum (string form). */
export type Likelihood =
  | "UNKNOWN"
  | "VERY_UNLIKELY"
  | "UNLIKELY"
  | "POSSIBLE"
  | "LIKELY"
  | "VERY_LIKELY";

export interface MediaModerationScores {
  adult: string;
  violence: string;
  racy: string;
}

export interface MediaModerationResult {
  safe: boolean;
  reason?: string;
  scores: MediaModerationScores;
}

export interface PerspectiveScores {
  toxicity: number;
  severeToxicity: number;
  identityAttack: number;
  insult: number;
  profanity: number;
  threat: number;
}

export interface TextModerationResult {
  safe: boolean;
  reason?: string;
  flaggedWords?: string[];
  scores?: PerspectiveScores;
  layer?: "word_filter" | "perspective";
  /**
   * Status of the Perspective (Layer 2) check, so the caller can apply its own
   * availability policy. Absent when Perspective wasn't reached (empty/too-short
   * text, or a word-filter rejection). The package always fails OPEN itself
   * (`safe: true`) when Perspective is unavailable — the caller decides whether
   * a missing key or an API error should instead block or alert.
   *  - `'ran'`            — Perspective was called and returned scores.
   *  - `'skipped_no_key'` — no API key was provided (Layer 2 did not run).
   *  - `'error'`          — Perspective returned non-OK or threw.
   */
  perspectiveStatus?: "ran" | "skipped_no_key" | "error";
}

export interface PerspectiveThresholds {
  toxicity: number;
  severeToxicity: number;
  identityAttack: number;
  insult: number;
  profanity: number;
  threat: number;
}

/** Generic logger used for diagnostic output. Consumers wire to their own. */
export interface ModerationLogger {
  info?: (message: string, ...args: unknown[]) => void;
  warn?: (message: string, ...args: unknown[]) => void;
  error?: (message: string, ...args: unknown[]) => void;
}
