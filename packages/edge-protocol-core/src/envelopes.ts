// Shared envelopes for internal edge messages: a structured error shape (used
// in edge responses AND persisted on durable job `lastError` fields) and a
// protocol-version marker so a rolling Worker/DO deploy can tolerate one
// version of skew (deploy reader before writer; no destructive migration in the
// same release that introduces a new payload).

import { z } from 'zod';

/** Structured error envelope shared by edge responses and durable-job `lastError`. */
export const StructuredErrorSchema = z
  .object({
    code: z.string().min(1),
    message: z.string(),
    /** Whether the caller may retry; absent ⇒ unknown/treat as non-retryable. */
    retryable: z.boolean().optional(),
    details: z.record(z.string(), z.unknown()).optional(),
    /** Epoch millis when the error was captured (optional). */
    at: z.number().optional(),
  })
  .strict();
export type StructuredError = z.infer<typeof StructuredErrorSchema>;

/** Current edge protocol version. Bump only with a one-version rolling-compat plan. */
export const EDGE_PROTOCOL_VERSION = 1 as const;

export const ProtocolVersionSchema = z.number().int().positive();

/**
 * One rolling version of backward/forward compatibility: a message tagged
 * `current ± 1` is accepted during a rolling deploy; anything further is not.
 */
export function isProtocolSupported(version: number, current: number = EDGE_PROTOCOL_VERSION): boolean {
  return Number.isInteger(version) && version >= 1 && Math.abs(version - current) <= 1;
}
