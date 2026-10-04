import { describe, expect, it } from 'vitest';
import * as notificationSchemas from '../src/schemas/notification';

// The archive answer is read by the tray (a row is cleared only when a card was archived) and
// written by the callable; both type it from this one declaration.
describe('archiveNotification answer', () => {
  it('says how many cards were archived, and for archive-all whether more remain', () => {
    expect(notificationSchemas.ArchiveNotificationResultSchema.parse({ success: true, archived: 0 })).toEqual({ success: true, archived: 0 });
    expect(notificationSchemas.ArchiveNotificationResultSchema.parse({ success: true, archived: 40, hasMore: true }).hasMore).toBe(true);
  });

  it('refuses a negative or fractional count, or an answer that is not a success', () => {
    expect(notificationSchemas.ArchiveNotificationResultSchema.safeParse({ success: true, archived: -1 }).success).toBe(false);
    expect(notificationSchemas.ArchiveNotificationResultSchema.safeParse({ success: true, archived: 0.5 }).success).toBe(false);
    expect(notificationSchemas.ArchiveNotificationResultSchema.safeParse({ success: false, archived: 1 }).success).toBe(false);
  });
});
