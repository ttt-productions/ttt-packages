import type {
  ModerationLogger,
  PerspectiveScores,
  PerspectiveThresholds,
  TextModerationResult,
} from "../types.js";

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

export interface PerspectiveCheckOptions {
  apiKey: string;
  thresholds: PerspectiveThresholds;
  logger?: ModerationLogger;
  /** Fetch implementation override (test-friendly). Defaults to globalThis.fetch. */
  fetchImpl?: typeof fetch;
}

export async function perspectiveCheck(
  text: string,
  options: PerspectiveCheckOptions,
): Promise<TextModerationResult> {
  const { apiKey, thresholds, logger } = options;
  const f = options.fetchImpl ?? fetch;

  if (!apiKey) {
    logger?.warn?.("[moderation-core] Perspective API key not provided; skipping Layer 2");
    return { safe: true, perspectiveStatus: "skipped_no_key" };
  }

  try {
    const response = await f(
      `https://commentanalyzer.googleapis.com/v1alpha1/comments:analyze?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          comment: { text },
          languages: ["en"],
          requestedAttributes: {
            TOXICITY: {},
            SEVERE_TOXICITY: {},
            IDENTITY_ATTACK: {},
            INSULT: {},
            PROFANITY: {},
            THREAT: {},
          },
        }),
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      logger?.error?.(`Perspective API error: ${response.status} - ${errorText}`);
      return { safe: true, perspectiveStatus: "error" };
    }

    const data = (await response.json()) as {
      attributeScores?: Record<string, { summaryScore?: { value?: number } }>;
    };
    const get = (k: string) => data.attributeScores?.[k]?.summaryScore?.value ?? 0;

    const scores: PerspectiveScores = {
      toxicity: get("TOXICITY"),
      severeToxicity: get("SEVERE_TOXICITY"),
      identityAttack: get("IDENTITY_ATTACK"),
      insult: get("INSULT"),
      profanity: get("PROFANITY"),
      threat: get("THREAT"),
    };

    if (scores.severeToxicity > thresholds.severeToxicity) {
      return { safe: false, reason: "Content contains severe toxicity", scores, layer: "perspective", perspectiveStatus: "ran" };
    }
    if (scores.identityAttack > thresholds.identityAttack) {
      return { safe: false, reason: "Content contains hate speech or identity-based attacks", scores, layer: "perspective", perspectiveStatus: "ran" };
    }
    if (scores.threat > thresholds.threat) {
      return { safe: false, reason: "Content contains threats", scores, layer: "perspective", perspectiveStatus: "ran" };
    }
    if (scores.toxicity > thresholds.toxicity) {
      return { safe: false, reason: "Content is too toxic", scores, layer: "perspective", perspectiveStatus: "ran" };
    }
    return { safe: true, scores, perspectiveStatus: "ran" };
  } catch (error) {
    logger?.error?.("[moderation-core] Perspective API request failed:", error);
    return { safe: true, perspectiveStatus: "error" };
  }
}

export interface ModerateTextOptions {
  wordList: WordListProvider;
  perspective: {
    getApiKey: () => string | undefined;
    thresholds: PerspectiveThresholds;
    fetchImpl?: typeof fetch;
  };
  /** Minimum text length before any moderation runs. Default 0 (always run). */
  minLength?: number;
  logger?: ModerationLogger;
}

/**
 * Two-layer text moderation: word filter (cheap, local) → Perspective API.
 * Returns a generic result — the caller decides how to respond
 * (throw HttpsError, log violation, etc.).
 */
export async function moderateText(
  text: string,
  options: ModerateTextOptions,
): Promise<TextModerationResult> {
  const { wordList, perspective, minLength = 0, logger } = options;
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

  const apiKey = perspective.getApiKey();
  const perspectiveResult = await perspectiveCheck(text, {
    apiKey: apiKey ?? "",
    thresholds: perspective.thresholds,
    logger,
    fetchImpl: perspective.fetchImpl,
  });
  if (!perspectiveResult.safe) return perspectiveResult;

  return { safe: true, scores: perspectiveResult.scores, perspectiveStatus: perspectiveResult.perspectiveStatus };
}
