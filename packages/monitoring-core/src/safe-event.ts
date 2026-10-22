export const DEFAULT_SAFE_EVENT_KEYS = ['caseId', 'phase', 'safeCode', 'traceId'] as const;

export type DefaultSafeEventKey = (typeof DEFAULT_SAFE_EVENT_KEYS)[number];

export type SafeEvent = {
  caseId?: string;
  phase?: string;
  safeCode?: string;
  traceId?: string;
  [key: string]: unknown;
};

export type BuildSafeEventOptions = {
  allowedKeys?: readonly string[];
  keepUndefined?: boolean;
};

export function buildSafeEvent(input: unknown, options: BuildSafeEventOptions = {}): SafeEvent {
  const allowed = options.allowedKeys ?? DEFAULT_SAFE_EVENT_KEYS;
  const keepUndefined = options.keepUndefined ?? false;
  const out: SafeEvent = {};

  if (input === null || typeof input !== 'object') {
    return out;
  }
  const record = input as Record<string, unknown>;

  for (const key of allowed) {
    if (!Object.prototype.hasOwnProperty.call(record, key)) continue;
    const value = record[key];
    if (value === undefined && !keepUndefined) continue;
    out[key] = value;
  }

  return out;
}
