import { describe, it, expect } from 'vitest';
import {
  CHAT_ARCHIVE_KEY_MAX_LENGTH,
  CHAT_INTERNAL_CALLS,
  CHAT_INTERNAL_PATHS,
  ChatAnonymizeScanRequestSchema,
  ChatAnonymizeSwapRequestSchema,
  ChatChannelModerateRequestSchema,
  chatInternalOperationId,
  isChatInternalPath,
  parseChatInternalRequest,
  type ChatInternalPath,
} from '../src/internal-calls.js';
import { CHAT_INTERNAL_BODY_MAX_BYTES } from '../src/internal-contract.js';

const room = 'app:dev:channel:group:g1';
const digest = 'a'.repeat(64);
const key = (suffix: string) => `archive/${'f'.repeat(64)}/3/${suffix}`;

const bodies: { readonly [P in ChatInternalPath]: { body: unknown; operationId: string } } = {
  [CHAT_INTERNAL_PATHS.syncApply]: {
    body: {
      eventId: 'ev-1',
      targetDo: room,
      kind: 'config',
      version: 2,
      payload: { archived: false },
      tombstone: false,
      payloadHash: digest,
    },
    operationId: 'ev-1',
  },
  [CHAT_INTERNAL_PATHS.outboxAppend]: {
    body: {
      commandId: 'cmd-1',
      kind: 'systemMsg',
      threadRef: room,
      payload: { senderId: 'system', text: 'hello' },
    },
    operationId: 'cmd-1',
  },
  [CHAT_INTERNAL_PATHS.wordListPublish]: {
    body: { wordListVersion: 7, words: ['x'], hash: digest },
    operationId: 'wordlist:7',
  },
  [CHAT_INTERNAL_PATHS.channelModerate]: {
    body: {
      requestId: 'req-1',
      targetDo: room,
      phase: 'prepare',
      action: 'hide',
      messageSeq: 4,
      expectedMessageRevision: 0,
    },
    operationId: 'req-1',
  },
  [CHAT_INTERNAL_PATHS.channelContext]: {
    body: { requestId: 'req-2', targetDo: room, reportedSeq: 9, before: 0, after: 0 },
    operationId: 'req-2',
  },
  [CHAT_INTERNAL_PATHS.anonymizableEpochs]: {
    body: { targetDo: room, operationId: 'op-1' },
    operationId: 'op-1',
  },
  [CHAT_INTERNAL_PATHS.anonymizeLive]: {
    body: { targetDo: room, operationId: 'op-2', anonymizedUid: 'u1', tombstoneUid: digest },
    operationId: 'op-2',
  },
  [CHAT_INTERNAL_PATHS.anonymizeScan]: {
    body: { targetDo: room, operationId: 'op-3', epoch: 3, anonymizedUid: 'u1' },
    operationId: 'op-3',
  },
  [CHAT_INTERNAL_PATHS.anonymizeRewrite]: {
    body: {
      targetDo: room,
      operationId: 'op-4',
      epoch: 3,
      replacementGeneration: 1,
      chunkOrdinal: 0,
      sourceChunkKey: key('0/0'),
      anonymizedUid: 'u1',
      tombstoneUid: digest,
      expectedSha256: digest,
    },
    operationId: 'op-4',
  },
  [CHAT_INTERNAL_PATHS.anonymizeSwap]: {
    body: {
      targetDo: room,
      operationId: 'op-5',
      epoch: 3,
      sourceManifestKey: key('manifest-0.json'),
      sourceManifestHash: digest,
      sourceGeneration: 0,
      replacementGeneration: 1,
      replacements: [
        { ordinal: 0, replacementChunkKey: key('anon-1/0'), replacementSha256: digest },
      ],
    },
    operationId: 'op-5',
  },
  [CHAT_INTERNAL_PATHS.anonymizeDelete]: {
    body: { targetDo: room, operationId: 'op-6', epoch: 3, chunkKey: key('0/0') },
    operationId: 'op-6',
  },
  [CHAT_INTERNAL_PATHS.anonymizeCleanup]: {
    body: { targetDo: room, operationId: 'op-7', epoch: 3, replacementGeneration: 1 },
    operationId: 'op-7',
  },
  [CHAT_INTERNAL_PATHS.roomReplayParked]: {
    body: { targetDo: room, eventId: 'ev-2' },
    operationId: 'ev-2',
  },
};

const paths = Object.values(CHAT_INTERNAL_PATHS);

describe('chat internal endpoint paths', () => {
  it('declares each endpoint once, under /internal/, with exactly one call entry per path', () => {
    expect(new Set(paths).size).toBe(paths.length);
    for (const path of paths) expect(path.startsWith('/internal/')).toBe(true);
    expect(Object.keys(CHAT_INTERNAL_CALLS).sort()).toEqual([...paths].sort());
  });

  it('recognizes every declared path and nothing else, including object-prototype names', () => {
    for (const path of paths) expect(isChatInternalPath(path)).toBe(true);
    for (const other of [
      '/internal/unknown',
      '/internal/sync/apply/',
      'constructor',
      '__proto__',
    ]) {
      expect(isChatInternalPath(other)).toBe(false);
    }
  });
});

describe('parseChatInternalRequest', () => {
  it('accepts the body each endpoint is sent and names the operation id the signer signs', () => {
    for (const path of paths) {
      const { body, operationId } = bodies[path];
      const parsed = parseChatInternalRequest(path, body);
      expect(parsed, path).toMatchObject({ ok: true, path, operationId });
      if (parsed.ok)
        expect(chatInternalOperationId(parsed.path, parsed.body as never)).toBe(operationId);
    }
  });

  it('refuses an unknown path before reading the body', () => {
    expect(parseChatInternalRequest('/internal/unknown', {})).toEqual({
      ok: false,
      reason: 'unknown-path',
    });
  });

  it('refuses a body with a field the endpoint does not take, or one missing a field it needs', () => {
    for (const path of paths) {
      const body = bodies[path].body as Record<string, unknown>;
      expect(parseChatInternalRequest(path, { ...body, extra: true }), path).toEqual({
        ok: false,
        reason: 'bad-body',
      });
      const [first] = Object.keys(body);
      const { [first!]: _dropped, ...missing } = body;
      expect(parseChatInternalRequest(path, missing), path).toEqual({
        ok: false,
        reason: 'bad-body',
      });
    }
  });
});

describe('the moderation body', () => {
  const base = { requestId: 'r', targetDo: room };

  it('takes a prepare, a finalize, or a probe', () => {
    expect(ChatChannelModerateRequestSchema.safeParse({ ...base, phase: 'finalize' }).success).toBe(
      true,
    );
    expect(ChatChannelModerateRequestSchema.safeParse({ ...base, probe: true }).success).toBe(true);
    for (const action of ['hide', 'delete']) {
      const prepare = {
        ...base,
        phase: 'prepare',
        action,
        messageSeq: 1,
        expectedMessageRevision: 0,
      };
      expect(ChatChannelModerateRequestSchema.safeParse(prepare).success).toBe(true);
    }
  });

  it('refuses an unknown action, a prepare without its target message, and a probe mixed with a phase', () => {
    const prepare = {
      ...base,
      phase: 'prepare',
      action: 'hide',
      messageSeq: 1,
      expectedMessageRevision: 0,
    };
    expect(
      ChatChannelModerateRequestSchema.safeParse({ ...prepare, action: 'restore' }).success,
    ).toBe(false);
    expect(
      ChatChannelModerateRequestSchema.safeParse({ ...base, phase: 'prepare', action: 'hide' })
        .success,
    ).toBe(false);
    expect(
      ChatChannelModerateRequestSchema.safeParse({ ...base, probe: true, phase: 'finalize' })
        .success,
    ).toBe(false);
    expect(ChatChannelModerateRequestSchema.safeParse({ ...base, probe: false }).success).toBe(
      false,
    );
  });
});

describe('the anonymization bodies', () => {
  it('a scan takes no existing generation, a null one, or a whole one', () => {
    const scan = { targetDo: room, operationId: 'o', epoch: 0, anonymizedUid: 'u' };
    expect(ChatAnonymizeScanRequestSchema.safeParse(scan).success).toBe(true);
    expect(
      ChatAnonymizeScanRequestSchema.safeParse({ ...scan, existingGeneration: null }).success,
    ).toBe(true);
    expect(
      ChatAnonymizeScanRequestSchema.safeParse({ ...scan, existingGeneration: 2 }).success,
    ).toBe(true);
    expect(
      ChatAnonymizeScanRequestSchema.safeParse({ ...scan, existingGeneration: 1.5 }).success,
    ).toBe(false);
  });

  it('bounds every archive key at CHAT_ARCHIVE_KEY_MAX_LENGTH, inside the internal body budget', () => {
    expect(CHAT_ARCHIVE_KEY_MAX_LENGTH).toBeLessThan(CHAT_INTERNAL_BODY_MAX_BYTES);
    const swap = bodies[CHAT_INTERNAL_PATHS.anonymizeSwap].body as Record<string, unknown>;
    const withKey = (k: string) => ({
      ...swap,
      replacements: [{ ordinal: 0, replacementChunkKey: k, replacementSha256: digest }],
    });
    expect(
      ChatAnonymizeSwapRequestSchema.safeParse(withKey('k'.repeat(CHAT_ARCHIVE_KEY_MAX_LENGTH)))
        .success,
    ).toBe(true);
    expect(
      ChatAnonymizeSwapRequestSchema.safeParse(withKey('k'.repeat(CHAT_ARCHIVE_KEY_MAX_LENGTH + 1)))
        .success,
    ).toBe(false);
    expect(
      ChatAnonymizeSwapRequestSchema.safeParse({
        ...swap,
        sourceManifestKey: 'k'.repeat(CHAT_ARCHIVE_KEY_MAX_LENGTH + 1),
      }).success,
    ).toBe(false);
  });
});
