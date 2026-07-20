// wireRowToMessage — attachment lifecycle → renderable `m.attachment` projection.
//
// REGRESSION GUARD: the renderer (MessageItemDefault → AttachmentView) keys on
// `m.attachment`; before this projection existed a wire-delivered attachment message
// (live broadcast, resume snapshot, history page) mapped to a message with NO
// `attachment` and rendered as an empty bubble — the recipient never saw the media
// at all. These tests pin the lifecycle → attachment mapping.

import { describe, it, expect } from 'vitest';
import { wireRowToMessage } from '../../src/realtime/map.js';
import type { WireMessageRow } from '../../src/realtime/wire.js';

function row(overrides: Partial<WireMessageRow>): WireMessageRow {
  return {
    seq: 7,
    senderUid: 'sender-1',
    clientMessageId: 'pm-123',
    text: '',
    replyTo: null,
    attachmentState: null,
    attachmentMeta: null,
    createdAt: 1000,
    epoch: 1,
    ...overrides,
  };
}

describe('wireRowToMessage — attachment projection', () => {
  it('a plain text row maps with NO attachment', () => {
    const m = wireRowToMessage(row({ text: 'hello' }), 't1');
    expect(m.attachment).toBeUndefined();
    expect(m.text).toBe('hello');
  });

  it('a ready row maps to a renderable attachment: type from attachmentKind, mediaAssetId, status ready', () => {
    const m = wireRowToMessage(
      row({
        attachmentState: 'ready',
        attachmentMeta: JSON.stringify({ senderOnly: false, mediaAssetId: 'asset-9', attachmentKind: 'video' }),
      }),
      't1',
    );
    expect(m.attachment).toMatchObject({
      id: 'pm-123',
      type: 'video',
      mediaAssetId: 'asset-9',
      status: 'ready',
    });
  });

  it('a pending row maps to a pending attachment (sender-only bubble)', () => {
    const m = wireRowToMessage(
      row({
        attachmentState: 'pending',
        attachmentMeta: JSON.stringify({ senderOnly: true, attachmentKind: 'audio' }),
      }),
      't1',
    );
    expect(m.attachment).toMatchObject({ type: 'audio', status: 'pending' });
    expect(m.attachment?.mediaAssetId).toBeUndefined();
  });

  it('a failed row carries status failed + failureReason', () => {
    const m = wireRowToMessage(
      row({
        attachmentState: 'failed',
        attachmentMeta: JSON.stringify({ senderOnly: true, failureReason: 'rejected', attachmentKind: 'image' }),
      }),
      't1',
    );
    expect(m.attachment).toMatchObject({ status: 'failed', failureReason: 'rejected' });
  });

  it("a ready row WITHOUT attachmentKind (pre-kind DO rows) falls back to 'image' so it still renders through the media path", () => {
    const m = wireRowToMessage(
      row({
        attachmentState: 'ready',
        attachmentMeta: JSON.stringify({ senderOnly: false, mediaAssetId: 'asset-legacy' }),
      }),
      't1',
    );
    expect(m.attachment).toMatchObject({ type: 'image', mediaAssetId: 'asset-legacy', status: 'ready' });
  });

  it('the raw lifecycle stays on meta.attachment* for consumers that key on it', () => {
    const m = wireRowToMessage(
      row({
        attachmentState: 'ready',
        attachmentMeta: JSON.stringify({ senderOnly: false, mediaAssetId: 'asset-9', attachmentKind: 'image' }),
      }),
      't1',
    );
    expect(m.meta?.attachmentState).toBe('ready');
    expect((m.meta?.attachmentMeta as Record<string, unknown>).mediaAssetId).toBe('asset-9');
  });
});
