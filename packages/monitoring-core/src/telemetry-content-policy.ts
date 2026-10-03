/**
 * Telemetry content policy — what an outgoing monitoring event may carry at all.
 *
 * The scrubber redacts known forbidden patterns; it cannot recognise free text. This policy is
 * the allowlist in front of it: an event keeps its error (type, message, stack — the scrubber
 * still runs over them) and only the diagnostic fields the app's key lists admit:
 *
 *   - never the incoming request (body, headers, cookies, query) and never breadcrumbs (console
 *     lines and HTTP records carry content);
 *   - the user as its account id only;
 *   - in tags, extras, and scope contexts: numbers, flags, and null under any key, since they
 *     cannot carry text; text and lists only under a diagnostic key, and only as tokens — a value
 *     holding whitespace is prose and is dropped, as is anything under another key;
 *   - the SDK's own runtime contexts, which carry no member data.
 *
 * GENERIC: the package owns the mechanism; the consuming app supplies which keys are diagnostic.
 * It imports no SDK and no Node API, so every runtime (browser, Node, edge) can apply it.
 */

import type { ScrubbableEvent } from "./scrubber.js";

/** The contexts the Sentry SDKs generate about the running process. */
export const DEFAULT_SDK_CONTEXTS = ["trace", "runtime", "os", "app", "device", "culture", "cloud_resource"] as const;

export type TelemetryContentPolicyOptions = {
  /** Keys whose text value is diagnostic, matched exactly. */
  diagnosticKeys: readonly string[];
  /** A key that starts with a lowercase letter and ends in one of these (camelCase: `Id` admits
   *  `caseId`, never `Id` alone) is diagnostic. */
  diagnosticKeySuffixes: readonly string[];
  /** Contexts whose `name` field is the code name of what ran, kept as a token. Any other
   *  context's `name` is checked like every other key. */
  codeNameContexts?: readonly string[];
  /** Contexts kept whole. Defaults to {@link DEFAULT_SDK_CONTEXTS}. */
  sdkContexts?: readonly string[];
};

export type TelemetryContentPolicy = {
  /** The event cut down to the policy, rewritten in place and returned, so it composes with the
   *  scrubber as one pre-send hook. */
  keepAllowlistedTelemetry: <T extends ScrubbableEvent>(event: T) => T;
  isDiagnosticKey: (key: string) => boolean;
};

/** An identifier, code, or enum value never holds whitespace; prose does. */
const TOKEN_VALUE = /^[A-Za-z0-9_.:@/+=#-]{1,200}$/;
const MAX_DEPTH = 4;
const MAX_ARRAY_ITEMS = 20;

function escapeRegExp(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** A number, flag, or null cannot carry text, so it is kept under any key. */
function keepScalar(value: unknown): unknown {
  if (value === null || typeof value === "boolean") return value;
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  return undefined;
}

export function createTelemetryContentPolicy(options: TelemetryContentPolicyOptions): TelemetryContentPolicy {
  const diagnosticKeys = new Set(options.diagnosticKeys);
  const suffixPattern =
    options.diagnosticKeySuffixes.length > 0
      ? new RegExp(`^[a-z][A-Za-z0-9]*(?:${options.diagnosticKeySuffixes.map(escapeRegExp).join("|")})$`)
      : null;
  const codeNameContexts = new Set(options.codeNameContexts ?? []);
  const sdkContexts = new Set<string>(options.sdkContexts ?? DEFAULT_SDK_CONTEXTS);

  function isDiagnosticKey(key: string): boolean {
    return diagnosticKeys.has(key) || (suffixPattern !== null && suffixPattern.test(key));
  }

  /** The diagnostic part of a value held under a diagnostic key, or `undefined` when none is. */
  function keepDiagnosticValue(value: unknown, depth: number): unknown {
    const scalar = keepScalar(value);
    if (scalar !== undefined) return scalar;
    if (typeof value === "string") return TOKEN_VALUE.test(value) ? value : undefined;
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

  function keepDiagnosticFields(fields: Record<string, unknown>, depth: number): Record<string, unknown> {
    const kept: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(fields)) {
      // A validation issue's `path` is a list of field names; a string `path` is a storage or
      // document path, which can name a member or their file.
      const isIssuePath = key === "path" && Array.isArray(value);
      const diagnostic = isIssuePath || isDiagnosticKey(key) ? keepDiagnosticValue(value, depth) : keepScalar(value);
      if (diagnostic !== undefined) kept[key] = diagnostic;
    }
    return kept;
  }

  function keepAllowlistedTelemetry<T extends ScrubbableEvent>(event: T): T {
    delete event.request;
    delete event.breadcrumbs;

    if (isRecord(event.user) && typeof event.user.id === "string" && TOKEN_VALUE.test(event.user.id)) {
      event.user = { id: event.user.id };
    } else {
      delete event.user;
    }

    if (isRecord(event.tags)) {
      // A tag holds one scalar: a number or flag under any key, text only under a diagnostic key.
      const tags: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(event.tags)) {
        const text = typeof value === "string" && isDiagnosticKey(key) && TOKEN_VALUE.test(value) ? value : undefined;
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
          if (isCodeName && typeof codeName === "string" && TOKEN_VALUE.test(codeName)) {
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
