/**
 * @ttt-productions/notification-core — Zod schemas
 *
 * Runtime validation schemas for the generic notification document shapes whose
 * TypeScript types live in `./types.ts`. notification-core OWNS these shapes, so
 * it owns their schemas too — the consuming app (e.g. `@ttt-productions/ttt-core`)
 * composes these rather than hand-mirroring them, so the schema can never drift
 * from the type.
 *
 * The interfaces in `./types.ts` remain the documented public type API. Each
 * schema is compile-time-checked against its interface via
 * `satisfies z.ZodType<Shape>` — a shape drift between the interface and the
 * schema fails the build here.
 *
 * zod-only, no React/firebase: safe for both server (Cloud Functions) and UI.
 */

import { z } from 'zod';
import type { NotificationDoc, PendingNotification } from './types.js';

/**
 * Active notification document (`NotificationDoc`). Same shape for both the user
 * and admin active collections.
 */
export const NotificationDocSchema = z.object({
  id: z.string(),
  type: z.string(),
  dedupKey: z.string(),
  category: z.string(),
  targetUserId: z.string().nullable(),
  title: z.string(),
  message: z.string(),
  count: z.number(),
  latestActorIds: z.array(z.string()),
  // Absent on linkless types (no defaultTargetPath in the type config).
  targetPath: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()),
  seenAt: z.number(),
  // Opaque per-generation token rotated on create / material re-light. Optional on
  // the legacy active doc shape; the ledger materializer always sets it.
  activityGeneration: z.string().optional(),
  seenAtGeneration: z.string().optional(),
  createdAt: z.number(),
  updatedAt: z.number(),
}) satisfies z.ZodType<NotificationDoc>;

/**
 * Pending notification (`PendingNotification`) — queue item for the batch processor.
 */
export const PendingNotificationSchema = z.object({
  id: z.string(),
  type: z.string(),
  category: z.string(),
  targetUserId: z.string().nullable(),
  actorId: z.string(),
  metadata: z.record(z.string(), z.unknown()),
  createdAt: z.number(),
}) satisfies z.ZodType<PendingNotification>;
