import type { ModerationLogger, TextModerationResult } from "../types.js";

export interface WordListProvider {
  /** Returns the active profanity word list. May read from cache, Firestore, etc. */
  getWords(): Promise<ReadonlySet<string>>;
}

/**
 * Build a memoized word-list provider. Calls `loader` on first use and
 * any time the cache is older than `ttlMs`.
 */
export function createWordListCache(args: {
  loader: () => Promise<Iterable<string>>;
  ttlMs: number;
  logger?: ModerationLogger;
}): WordListProvider & { __reset(): void } {
  let cached: Set<string> | null = null;
  let cachedAt = 0;

  return {
    async getWords() {
      const now = Date.now();
      if (cached && now - cachedAt < args.ttlMs) return cached;
      const fresh = await args.loader();
      cached = new Set(fresh);
      cachedAt = now;
      args.logger?.info?.(`[moderation-core] Loaded ${cached.size} words into cache`);
      return cached;
    },
    __reset() {
      cached = null;
      cachedAt = 0;
    },
  };
}

const LEET_SPEAK_MAP: Record<string, string> = {
  "0": "o", "1": "i", "3": "e", "4": "a", "5": "s",
  "7": "t", "8": "b", "@": "a", "$": "s", "!": "i", "+": "t",
};

function normalizeText(text: string): string {
  let normalized = text.toLowerCase();
  for (const [leet, letter] of Object.entries(LEET_SPEAK_MAP)) {
    normalized = normalized.split(leet).join(letter);
  }
  // Collapse 3+ repeated chars to 2 (e.g. "fuuuck" → "fuuck")
  normalized = normalized.replace(/(.)\1{2,}/g, "$1$1");
  return normalized;
}

export async function quickWordFilter(
  text: string,
  wordList: WordListProvider,
): Promise<{ pass: boolean; flaggedWords: string[] }> {
  const words = await wordList.getWords();
  if (words.size === 0) return { pass: true, flaggedWords: [] };

  const normalized = normalizeText(text);
  const tokens = normalized.split(/[\s.,!?;:'"()[\]{}<>/\\|`~@#$%^&*+=_-]+/);
  const flagged: string[] = [];
  for (const token of tokens) {
    const clean = token.replace(/[^a-z0-9]/gi, "");
    if (clean.length > 1 && words.has(clean)) flagged.push(clean);
  }
  return { pass: flagged.length === 0, flaggedWords: flagged };
}

export interface ModerateTextOptions {
  wordList: WordListProvider;
  /** Minimum text length before any moderation runs. Default 0 (always run). */
  minLength?: number;
  logger?: ModerationLogger;
}

/**
 * Word-list text moderation (cheap, local). Returns a generic result — the
 * caller decides how to respond (throw HttpsError, log violation, etc.).
 */
export async function moderateText(
  text: string,
  options: ModerateTextOptions,
): Promise<TextModerationResult> {
  const { wordList, minLength = 0, logger } = options;
  if (!text || text.trim().length === 0) return { safe: true };
  if (text.trim().length < minLength) return { safe: true };

  logger?.info?.(`[moderation-core] Text moderation: ${text.length} chars`);

  const wordCheck = await quickWordFilter(text, wordList);
  if (!wordCheck.pass) {
    return {
      safe: false,
      reason: "Content contains prohibited language",
      flaggedWords: wordCheck.flaggedWords,
      layer: "word_filter",
    };
  }

  return { safe: true };
}
