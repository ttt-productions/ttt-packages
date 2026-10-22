import { z } from 'zod';

export const AdminDispatchReadMarkerSchema = z.object({
  adminDispatchId: z.string(),
  uid: z.string(),
  lastSeenMessageAt: z.number(),
  updatedAt: z.number(),
});
export type AdminDispatchReadMarker = z.infer<typeof AdminDispatchReadMarkerSchema>;

export function hasUnseenAdminDispatchMessage(
  thread: { lastMessageAt: number },
  marker: Pick<AdminDispatchReadMarker, 'lastSeenMessageAt'> | null | undefined,
): boolean {
  return thread.lastMessageAt > (marker?.lastSeenMessageAt ?? 0);
}
