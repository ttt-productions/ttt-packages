export type Likelihood =
  'UNKNOWN' | 'VERY_UNLIKELY' | 'UNLIKELY' | 'POSSIBLE' | 'LIKELY' | 'VERY_LIKELY';

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
