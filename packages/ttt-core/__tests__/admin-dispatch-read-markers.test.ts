import { describe, it, expect } from 'vitest';
import { hasUnseenAdminDispatchMessage } from '../src/doc-schemas/admin-dispatch-read-markers';
import {
  MarkAdminDispatchReadInputSchema,
  MarkAdminDispatchReadResultSchema,
} from '../src/schemas/utility';

describe('per-person dispatch unread', () => {
  it('is unread for a reader with no marker yet', () => {
    expect(hasUnseenAdminDispatchMessage({ lastMessageAt: 10 }, undefined)).toBe(true);
  });

  it('is read once the reader has seen through the latest message', () => {
    expect(hasUnseenAdminDispatchMessage({ lastMessageAt: 10 }, { lastSeenMessageAt: 10 })).toBe(false);
  });

  it('relights for a reader when a newer message arrives', () => {
    expect(hasUnseenAdminDispatchMessage({ lastMessageAt: 11 }, { lastSeenMessageAt: 10 })).toBe(true);
  });

  it('is decided per reader — one reader seeing the thread leaves another unread', () => {
    const thread = { lastMessageAt: 20 };
    expect(hasUnseenAdminDispatchMessage(thread, { lastSeenMessageAt: 20 })).toBe(false);
    expect(hasUnseenAdminDispatchMessage(thread, { lastSeenMessageAt: 5 })).toBe(true);
  });
});

describe('mark-read contract', () => {
  it('names the newest message time the caller has on screen', () => {
    expect(MarkAdminDispatchReadInputSchema.safeParse({ adminDispatchId: 'd1', seenThroughMessageAt: 10 }).success).toBe(true);
    expect(MarkAdminDispatchReadInputSchema.safeParse({ adminDispatchId: 'd1' }).success).toBe(false);
    expect(MarkAdminDispatchReadInputSchema.safeParse({ adminDispatchId: 'd1', seenThroughMessageAt: -1 }).success).toBe(false);
  });

  it('never accepts a reader other than the caller', () => {
    expect(
      MarkAdminDispatchReadInputSchema.safeParse({ adminDispatchId: 'd1', seenThroughMessageAt: 10, uid: 'other' }).success,
    ).toBe(false);
  });

  it("answers the caller's committed marker", () => {
    expect(
      MarkAdminDispatchReadResultSchema.safeParse({ success: true, adminDispatchId: 'd1', lastSeenMessageAt: 10 }).success,
    ).toBe(true);
    expect(MarkAdminDispatchReadResultSchema.safeParse({ success: true }).success).toBe(false);
  });
});
