// Guild chat channel LIFECYCLE callable inputs. One named schema per callable (archive /
// unarchive / delete) rather than a shared alias, so a lane can diverge without touching its
// siblings — while these tests pin the fact that today the three shapes are identical and all
// three are `.strict()`.

import { describe, it, expect } from 'vitest';
import {
  ArchiveGuildChatChannelInputSchema,
  UnarchiveGuildChatChannelInputSchema,
  DeleteGuildChatChannelInputSchema,
} from '../src/schemas/chat';

const validInput = { workProjectId: 'wp-1', guildChatChannelId: 'chan-1' };

describe('UnarchiveGuildChatChannelInputSchema', () => {
  it('accepts a workProjectId + guildChatChannelId pair', () => {
    expect(UnarchiveGuildChatChannelInputSchema.parse(validInput)).toEqual(validInput);
  });

  it('requires both ids and rejects empty ones', () => {
    expect(UnarchiveGuildChatChannelInputSchema.safeParse({ workProjectId: 'wp-1' }).success).toBe(false);
    expect(UnarchiveGuildChatChannelInputSchema.safeParse({ guildChatChannelId: 'chan-1' }).success).toBe(false);
    expect(
      UnarchiveGuildChatChannelInputSchema.safeParse({ ...validInput, workProjectId: '' }).success,
    ).toBe(false);
    expect(
      UnarchiveGuildChatChannelInputSchema.safeParse({ ...validInput, guildChatChannelId: '' }).success,
    ).toBe(false);
  });

  it('is strict — an unknown key is rejected, never silently dropped', () => {
    const result = UnarchiveGuildChatChannelInputSchema.safeParse({ ...validInput, isArchived: false });
    expect(result.success).toBe(false);
    // A caller must not be able to smuggle the state it is asking the server to derive.
    expect(UnarchiveGuildChatChannelInputSchema.safeParse({ ...validInput, force: true }).success).toBe(false);
  });

  it('rejects non-string ids', () => {
    expect(UnarchiveGuildChatChannelInputSchema.safeParse({ ...validInput, workProjectId: 1 }).success).toBe(false);
    expect(
      UnarchiveGuildChatChannelInputSchema.safeParse({ ...validInput, guildChatChannelId: null }).success,
    ).toBe(false);
  });
});

describe('the three channel-lifecycle inputs are separate declarations of one shape', () => {
  const lanes = {
    archive: ArchiveGuildChatChannelInputSchema,
    unarchive: UnarchiveGuildChatChannelInputSchema,
    delete: DeleteGuildChatChannelInputSchema,
  };

  for (const [lane, schema] of Object.entries(lanes)) {
    it(`${lane} accepts the valid pair and rejects an unknown key`, () => {
      expect(schema.parse(validInput)).toEqual(validInput);
      expect(schema.safeParse({ ...validInput, extra: 'x' }).success).toBe(false);
    });
  }

  it('are distinct schema objects, not aliases of one another', () => {
    expect(UnarchiveGuildChatChannelInputSchema).not.toBe(ArchiveGuildChatChannelInputSchema);
    expect(UnarchiveGuildChatChannelInputSchema).not.toBe(DeleteGuildChatChannelInputSchema);
  });
});
