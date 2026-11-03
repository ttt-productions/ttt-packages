import { z } from 'zod';
import { gameIdSchema } from './atoms.js';

export const GhostRemovedFinishedEntrySchema = z.object({
  gameId: gameIdSchema,
  wasAbsent: z.boolean(),
  wasNonScoring: z.boolean(),
});
export type GhostRemovedFinishedEntry = z.infer<typeof GhostRemovedFinishedEntrySchema>;

export const GhostLinkedGameSchema = z.object({
  gameId: gameIdSchema,
  completed: z.boolean(),
  merged: z.boolean(),
});
export type GhostLinkedGame = z.infer<typeof GhostLinkedGameSchema>;

export const StatsDestinationChangeSchema = z.object({
  ref: z.string().min(1),
  field: z.string().min(1),
  before: z.record(z.string(), z.number()).nullable(),
  after: z.record(z.string(), z.number()).nullable(),
});
export type StatsDestinationChange = z.infer<typeof StatsDestinationChangeSchema>;
