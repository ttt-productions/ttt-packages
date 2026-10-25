export const REDACTION_PLACEHOLDER = '[REDACTED]';

export type ForbiddenPattern = RegExp | string;

export type RedactStringOptions = {
  patterns?: ForbiddenPattern[];
  placeholder?: string;
};

export const DEFAULT_FORBIDDEN_PATTERNS: RegExp[] = [
  /\b(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\b/g,
  /\b(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}\b/g,
  /\b(?:[0-9a-fA-F]{1,4}:){1,7}:(?:[0-9a-fA-F]{1,4}:?){0,6}(?:[0-9a-fA-F]{1,4})?\b|::(?:[0-9a-fA-F]{1,4}:){0,6}[0-9a-fA-F]{1,4}\b/g,
  /\b(?:Bearer|Basic)\s+[A-Za-z0-9._~+/-]{8,}={0,2}/gi,
  /\b(?:oob[_-]?code|[a-z]*[_-]?token)\b\s*[:=]\s*["']?[^\s"',}{&]{4,}/gi,
  /\b(?:password|passwd|pwd|secret|api[_-]?key|apikey|access[_-]?token|refresh[_-]?token|token|client[_-]?secret|authorization)\b\s*[:=]\s*["']?[^\s"',}{]{4,}/gi,
];

type CompiledPattern = { regex: RegExp; isLiteral: boolean; literal?: string };

function escapeRegExp(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function compilePatterns(patterns: ForbiddenPattern[]): CompiledPattern[] {
  return patterns.map((p) => {
    if (typeof p === 'string') {
      return {
        regex: new RegExp(escapeRegExp(p), 'g'),
        isLiteral: true,
        literal: p,
      };
    }
    const flags = p.flags.includes('g') ? p.flags : p.flags + 'g';
    return { regex: new RegExp(p.source, flags), isLiteral: false };
  });
}

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

function deepRedact(value: unknown, options: DeepRedactOptions, seen: WeakSet<object>): unknown {
  if (typeof value === 'string') {
    return redactString(value, options);
  }
  if (value === null || typeof value !== 'object') {
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

export type ScrubbableEvent = {
  message?: unknown;
  exception?: { values?: Array<Record<string, unknown>> } | unknown;
  breadcrumbs?: unknown;
  extra?: unknown;
  contexts?: unknown;
  tags?: unknown;
  request?: unknown;
  user?: unknown;
  transaction?: unknown;
  spans?: unknown;
  urls?: unknown;
};

export type TelemetryScrubberOptions = {
  patterns?: ForbiddenPattern[];
  includeDefaults?: boolean;
  placeholder?: string;
};

export function redactEvent<T extends ScrubbableEvent>(
  event: T,
  options: TelemetryScrubberOptions = {},
): T {
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

  if (event.message !== undefined) {
    event.message = deepRedact(event.message, deepOptions, seen);
  }

  const exception = event.exception as { values?: Array<Record<string, unknown>> } | undefined;
  if (exception && Array.isArray(exception.values)) {
    for (const val of exception.values) {
      deepRedact(val, deepOptions, seen);
    }
  }

  for (const container of [
    'breadcrumbs',
    'extra',
    'contexts',
    'tags',
    'request',
    'user',
    'transaction',
    'urls',
  ] as const) {
    if (event[container] !== undefined) {
      event[container] = deepRedact(event[container], deepOptions, seen);
    }
  }

  if (Array.isArray(event.spans)) {
    for (const span of event.spans) {
      if (span === null || typeof span !== 'object') continue;
      const record = span as Record<string, unknown>;
      for (const field of ['description', 'data'] as const) {
        if (record[field] !== undefined) {
          record[field] = deepRedact(record[field], deepOptions, seen);
        }
      }
    }
  }

  return event;
}

export type BeforeSendHint = { originalException?: unknown } & Record<string, unknown>;

export type BeforeSendHook = <T extends ScrubbableEvent>(
  event: T,
  hint?: BeforeSendHint,
) => T | null;

export type TelemetryScrubber = <T extends ScrubbableEvent>(event: T, hint?: BeforeSendHint) => T;

export function createTelemetryScrubber(options: TelemetryScrubberOptions = {}): TelemetryScrubber {
  return (event, _hint) => redactEvent(event, options);
}
