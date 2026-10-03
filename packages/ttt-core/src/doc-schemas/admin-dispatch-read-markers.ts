import { z } from 'zod';

// Per-person "you haven't seen the latest message" marker for one admin-dispatch thread:
// `pendingAdminDispatches/{adminDispatchId}/dispatchReadMarkers/{uid}`, written only by the
// backend (the mark-read callable for the reader, and the message sender for the sender's own
// marker). Each member-side reader of a thread — its owner, or each active member of a Work
// thread — has their own marker, so one reader opening the thread never clears it for another.
// The admin queue does not use markers: its "Awaiting reply" state is the thread's own field.
export const AdminDispatchReadMarkerSchema = z.object({
  adminDispatchId: z.string(),
  /** The reader — also the doc id. */
  uid: z.string(),
  /** The thread's `lastMessageAt` this reader has seen through (epoch ms; never moves backwards). */
  lastSeenMessageAt: z.number(),
  updatedAt: z.number(),
});
export type AdminDispatchReadMarker = z.infer<typeof AdminDispatchReadMarkerSchema>;

/**
 * Whether a reader has a message in the thread they have not seen: the thread's latest message
 * is newer than their marker (no marker — nothing seen yet).
 */
export function hasUnseenAdminDispatchMessage(
  thread: { lastMessageAt: number },
  marker: Pick<AdminDispatchReadMarker, 'lastSeenMessageAt'> | null | undefined,
): boolean {
  return thread.lastMessageAt > (marker?.lastSeenMessageAt ?? 0);
}
