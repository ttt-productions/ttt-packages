/**
 * Telemetry scrubber — generic Sentry-event redaction.
 *
 * A defense-in-depth `beforeSend`-style hook that walks an ENTIRE Sentry event
 * (message, exception values + stacktrace frame vars, breadcrumbs, extra,
 * contexts, tags, request data, user) and replaces any substring matching a
 * forbidden pattern with a fixed placeholder.
 *
 * This package is GENERIC — it ships only obvious, domain-neutral defaults
 * (full IPv4/IPv6 addresses, bearer/authorization tokens, generic credential
 * assignments). TTT-specific patterns (evidence-bucket URL prefixes,
 * detector-hash shapes, NCMEC credential markers) are INJECTED by the consuming
 * app via {@link createTelemetryScrubber}'s `patterns` option. No `ttt-core`
 * import, no app-specific literals.
 */

/** The fixed replacement written over any matched forbidden substring. */
export const REDACTION_PLACEHOLDER = "[REDACTED]";

/**
 * A forbidden pattern. Either a `RegExp` (matched globally against every string
 * in the event) or a literal `string` (every occurrence replaced). Strings are
 * treated as literals, not regex source, so callers do not have to escape them.
 */
export type ForbiddenPattern = RegExp | string;

export type RedactStringOptions = {
  /** Patterns to strip. Defaults to {@link DEFAULT_FORBIDDEN_PATTERNS}. */
  patterns?: ForbiddenPattern[];
  /** Replacement text. Defaults to {@link REDACTION_PLACEHOLDER}. */
  placeholder?: string;
};

/**
 * Generic, domain-neutral built-in patterns. These are intentionally
 * conservative (specific → low collateral on ordinary errors) but catch the
 * obvious secrets that must never reach telemetry regardless of app.
 */
export const DEFAULT_FORBIDDEN_PATTERNS: RegExp[] = [
  // Full IPv4 address (four dotted octets, each 0–255).
  /\b(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\b/g,
  // Full (uncompressed) IPv6 address — eight hextet groups.
  /\b(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}\b/g,
  // Compressed IPv6 with a "::" run (e.g. 2001:db8::1, ::1, fe80::abcd).
  /\b(?:[0-9a-fA-F]{1,4}:){1,7}:(?:[0-9a-fA-F]{1,4}:?){0,6}(?:[0-9a-fA-F]{1,4})?\b|::(?:[0-9a-fA-F]{1,4}:){0,6}[0-9a-fA-F]{1,4}\b/g,
  // Authorization / bearer token: "Bearer xyz", "Authorization: Basic xyz".
  /\b(?:Bearer|Basic)\s+[A-Za-z0-9._~+/-]{8,}={0,2}/gi,
  // Generic credential assignment: password=..., api_key: "...", secret=...,
  // token=..., apiKey=..., access_token=... (value up to whitespace/quote).
  /\b(?:password|passwd|pwd|secret|api[_-]?key|apikey|access[_-]?token|refresh[_-]?token|token|client[_-]?secret|authorization)\b\s*[:=]\s*["']?[^\s"',}{]{4,}/gi,
];

type CompiledPattern = { regex: RegExp; isLiteral: boolean; literal?: string };

function escapeRegExp(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function compilePatterns(patterns: ForbiddenPattern[]): CompiledPattern[] {
  return patterns.map((p) => {
    if (typeof p === "string") {
      return {
        regex: new RegExp(escapeRegExp(p), "g"),
        isLiteral: true,
        literal: p,
      };
    }
    // Ensure the flag set is global so `String.replace` strips every hit; clone
    // so we never mutate a caller-owned RegExp's lastIndex across calls.
    const flags = p.flags.includes("g") ? p.flags : p.flags + "g";
    return { regex: new RegExp(p.source, flags), isLiteral: false };
  });
}

/**
 * Redact every forbidden-pattern hit inside a single string. Pure and safe on
 * any input. Empty when nothing matches → returns the original reference.
 */
export function redactString(value: string, options: RedactStringOptions = {}): string {
  const placeholder = options.placeholder ?? REDACTION_PLACEHOLDER;
  const compiled = compilePatterns(options.patterns ?? DEFAULT_FORBIDDEN_PATTERNS);
  let out = value;
  for (const { regex } of compiled) {
    regex.lastIndex = 0;
    out = out.replace(regex, placeholder);
  }
  return out;
}

type DeepRedactOptions = {
  patterns: ForbiddenPattern[];
  placeholder: string;
};

/**
 * Recursively redact every string reachable inside an arbitrary value (objects,
 * arrays, nested combinations). Non-string primitives pass through untouched.
 * Object keys are NOT rewritten (a forbidden value hiding in a key is
 * pathological and rewriting keys would corrupt the event shape); only values
 * are scrubbed. Guards against cycles.
 */
function deepRedact(value: unknown, options: DeepRedactOptions, seen: WeakSet<object>): unknown {
  if (typeof value === "string") {
    return redactString(value, options);
  }
  if (value === null || typeof value !== "object") {
    return value;
  }
  if (seen.has(value as object)) {
    return value;
  }
  seen.add(value as object);

  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      value[i] = deepRedact(value[i], options, seen);
    }
    return value;
  }

  const record = value as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    record[key] = deepRedact(record[key], options, seen);
  }
  return record;
}

/**
 * Minimal structural shape of a Sentry event we walk. Deliberately loose — we
 * do not depend on `@sentry/*` types (this package's Sentry deps are optional
 * peers, and the scrubber is provider-agnostic). Unknown fields are left alone
 * except that we deep-redact the free-form containers below.
 */
export type ScrubbableEvent = {
  message?: unknown;
  exception?: { values?: Array<Record<string, unknown>> } | unknown;
  breadcrumbs?: unknown;
  extra?: unknown;
  contexts?: unknown;
  tags?: unknown;
  request?: unknown;
  user?: unknown;
  [key: string]: unknown;
};

export type TelemetryScrubberOptions = {
  /**
   * App-injected forbidden patterns (evidence-bucket URL prefixes, detector-hash
   * shapes, NCMEC credential markers, …). Merged AFTER the generic defaults
   * unless {@link includeDefaults} is false.
   */
  patterns?: ForbiddenPattern[];
  /** Include {@link DEFAULT_FORBIDDEN_PATTERNS}. Defaults to true. */
  includeDefaults?: boolean;
  /** Replacement text. Defaults to {@link REDACTION_PLACEHOLDER}. */
  placeholder?: string;
};

/**
 * Redact a whole Sentry event in place and return it. Exported so the backend
 * `withScope` / manual-capture path can benefit even where a `beforeSend`
 * pipeline is not wired.
 */
export function redactEvent<T extends ScrubbableEvent>(
  event: T,
  options: TelemetryScrubberOptions = {}
): T {
  if (event === null || typeof event !== "object") return event;

  const includeDefaults = options.includeDefaults ?? true;
  const patterns: ForbiddenPattern[] = [
    ...(includeDefaults ? DEFAULT_FORBIDDEN_PATTERNS : []),
    ...(options.patterns ?? []),
  ];
  const deepOptions: DeepRedactOptions = {
    patterns,
    placeholder: options.placeholder ?? REDACTION_PLACEHOLDER,
  };
  const seen = new WeakSet<object>();

  // Top-level message (string or {message,params} structured form).
  if (event.message !== undefined) {
    event.message = deepRedact(event.message, deepOptions, seen);
  }

  // Exception values: type/value strings plus stacktrace frame vars/filenames.
  const exception = event.exception as { values?: Array<Record<string, unknown>> } | undefined;
  if (exception && Array.isArray(exception.values)) {
    for (const val of exception.values) {
      deepRedact(val, deepOptions, seen);
    }
  }

  // Free-form containers — walked wholesale.
  for (const container of ["breadcrumbs", "extra", "contexts", "tags", "request", "user"] as const) {
    if (event[container] !== undefined) {
      event[container] = deepRedact(event[container], deepOptions, seen);
    }
  }

  return event;
}

/**
 * A Sentry `beforeSend`-style hook: `(event, hint?) => event | null`. Drop-in
 * for `Sentry.init({ beforeSend })` in both the browser and Node SDKs.
 */
export type BeforeSendHook = (event: ScrubbableEvent, hint?: unknown) => ScrubbableEvent | null;

/**
 * Build a `beforeSend` hook that scrubs every outgoing event. The app supplies
 * its TTT-specific `patterns`; generic defaults are included unless disabled.
 *
 * @example
 * Sentry.init({
 *   dsn,
 *   beforeSend: createTelemetryScrubber({
 *     patterns: [
 *       'https://storage.googleapis.com/ttt-prod-ncii-evidence/',
 *       /\bncmec-[a-z0-9]{16,}\b/gi,
 *       /\b[a-f0-9]{64}\b/g, // detector hash shape
 *     ],
 *   }),
 * });
 */
export function createTelemetryScrubber(options: TelemetryScrubberOptions = {}): BeforeSendHook {
  return (event, _hint) => {
    if (event === null || typeof event !== "object") return event;
    return redactEvent(event, options);
  };
}
