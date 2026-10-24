export type Likelihood =
  'UNKNOWN' | 'VERY_UNLIKELY' | 'UNLIKELY' | 'POSSIBLE' | 'LIKELY' | 'VERY_LIKELY';

export interface MediaModerationScores {
  adult: string;
  violence: string;
  racy: string;
}

export interface CheckedMediaModerationResult {
  checked: true;
  safe: boolean;
  reason?: string;
  scores: MediaModerationScores;
}

// `safe: false` keeps a consumer that reads only `safe` failing closed on a check that never ran.
export interface UncheckedMediaModerationResult {
  checked: false;
  safe: false;
  reason: string;
  scores: MediaModerationScores;
}

export type MediaModerationResult = CheckedMediaModerationResult | UncheckedMediaModerationResult;

export interface TextModerationResult {
  safe: boolean;
  reason?: string;
  flaggedWords?: string[];
  layer?: 'word_filter';
}

export interface ModerationLogger {
  info?: (message: string, ...args: unknown[]) => void;
  warn?: (message: string, ...args: unknown[]) => void;
  error?: (message: string, ...args: unknown[]) => void;
}
