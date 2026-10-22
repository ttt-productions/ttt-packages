import type { ScrubbableEvent } from './scrubber.js';

export const DEFAULT_SDK_CONTEXTS = [
  'trace',
  'runtime',
  'os',
  'app',
  'device',
  'culture',
  'cloud_resource',
] as const;

export type TelemetryContentPolicyOptions = {
  diagnosticKeys: readonly string[];
  diagnosticKeySuffixes: readonly string[];
  codeNameContexts?: readonly string[];
  sdkContexts?: readonly string[];
};

export type TelemetryContentPolicy = {
  keepAllowlistedTelemetry: <T extends ScrubbableEvent>(event: T) => T;
  isDiagnosticKey: (key: string) => boolean;
};

const TOKEN_VALUE = /^[A-Za-z0-9_.:@/+=#-]{1,200}$/;
const MAX_DEPTH = 4;
const MAX_ARRAY_ITEMS = 20;

function escapeRegExp(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function keepScalar(value: unknown): unknown {
  if (value === null || typeof value === 'boolean') return value;
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  return undefined;
}

export function createTelemetryContentPolicy(
  options: TelemetryContentPolicyOptions,
): TelemetryContentPolicy {
  const diagnosticKeys = new Set(options.diagnosticKeys);
  const suffixPattern =
    options.diagnosticKeySuffixes.length > 0
      ? new RegExp(
          `^[a-z][A-Za-z0-9]*(?:${options.diagnosticKeySuffixes.map(escapeRegExp).join('|')})$`,
        )
      : null;
  const codeNameContexts = new Set(options.codeNameContexts ?? []);
  const sdkContexts = new Set<string>(options.sdkContexts ?? DEFAULT_SDK_CONTEXTS);

  function isDiagnosticKey(key: string): boolean {
    return diagnosticKeys.has(key) || (suffixPattern !== null && suffixPattern.test(key));
  }

  function keepDiagnosticValue(value: unknown, depth: number): unknown {
    const scalar = keepScalar(value);
    if (scalar !== undefined) return scalar;
    if (typeof value === 'string') return TOKEN_VALUE.test(value) ? value : undefined;
    if (depth >= MAX_DEPTH) return undefined;
    if (Array.isArray(value)) {
      const kept = value
        .slice(0, MAX_ARRAY_ITEMS)
        .map((item) => keepDiagnosticValue(item, depth + 1))
        .filter((item) => item !== undefined);
      return kept.length > 0 ? kept : undefined;
    }
    if (isRecord(value)) {
      const kept = keepDiagnosticFields(value, depth + 1);
      return Object.keys(kept).length > 0 ? kept : undefined;
    }
    return undefined;
  }

  function keepDiagnosticFields(
    fields: Record<string, unknown>,
    depth: number,
  ): Record<string, unknown> {
    const kept: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(fields)) {
      // A string `path` is a storage or document path, which can name a member or their file.
      const isIssuePath = key === 'path' && Array.isArray(value);
      const diagnostic =
        isIssuePath || isDiagnosticKey(key) ? keepDiagnosticValue(value, depth) : keepScalar(value);
      if (diagnostic !== undefined) kept[key] = diagnostic;
    }
    return kept;
  }

  function keepAllowlistedTelemetry<T extends ScrubbableEvent>(event: T): T {
    delete event.request;
    delete event.breadcrumbs;

    if (
      isRecord(event.user) &&
      typeof event.user.id === 'string' &&
      TOKEN_VALUE.test(event.user.id)
    ) {
      event.user = { id: event.user.id };
    } else {
      delete event.user;
    }

    if (isRecord(event.tags)) {
      const tags: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(event.tags)) {
        const text =
          typeof value === 'string' && isDiagnosticKey(key) && TOKEN_VALUE.test(value)
            ? value
            : undefined;
        const kept = keepScalar(value) ?? text;
        if (kept !== undefined) tags[key] = kept;
      }
      event.tags = tags;
    } else {
      delete event.tags;
    }

    event.extra = isRecord(event.extra) ? keepDiagnosticFields(event.extra, 0) : {};

    if (isRecord(event.contexts)) {
      const contexts: Record<string, unknown> = {};
      for (const [name, context] of Object.entries(event.contexts)) {
        if (sdkContexts.has(name)) {
          contexts[name] = context;
        } else if (isRecord(context)) {
          const isCodeName = codeNameContexts.has(name);
          const { name: codeName, ...rest } = context;
          const kept = keepDiagnosticFields(isCodeName ? rest : context, 1);
          if (isCodeName && typeof codeName === 'string' && TOKEN_VALUE.test(codeName)) {
            kept.name = codeName;
          }
          if (Object.keys(kept).length > 0) contexts[name] = kept;
        }
      }
      event.contexts = contexts;
    }

    return event;
  }

  return { keepAllowlistedTelemetry, isDiagnosticKey };
}
