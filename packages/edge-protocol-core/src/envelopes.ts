import { z } from 'zod';

export const StructuredErrorSchema = z
  .object({
    code: z.string().min(1),
    message: z.string(),
    retryable: z.boolean().optional(),
    details: z.record(z.string(), z.unknown()).optional(),
    at: z.number().optional(),
  })
  .strict();
export type StructuredError = z.infer<typeof StructuredErrorSchema>;

// Bump only with a one-version rolling-compat plan.
export const EDGE_PROTOCOL_VERSION = 1 as const;

export const ProtocolVersionSchema = z.number().int().positive();

export function isProtocolSupported(
  version: number,
  current: number = EDGE_PROTOCOL_VERSION,
): boolean {
  return Number.isInteger(version) && version >= 1 && Math.abs(version - current) <= 1;
}
