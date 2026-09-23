import { describe, it, expect, expectTypeOf } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { z } from 'zod';
import { createPendingMediaSchemas } from '../src/factories/pending-media.js';
import {
  buildPendingMediaTerminalFields,
  decidePendingMediaClaim,
  decidePendingMediaFinalize,
  effectivePendingMediaLeaseExpiry,
  isPendingMediaTerminalStatus,
  type PendingMediaClaimPolicy,
  type PendingMediaCompletedTerminalFields,
  type PendingMediaFailedTerminalFields,
  type PendingMediaRejectedTerminalFields,
  type PendingMediaTerminalFields,
  type PendingMediaTerminalStatus,
} from '../src/pending-media-lifecycle.js';

// Fixed clock and an injected policy: the package owns the state machine, the app owns
// the numbers.
const NOW = 1_700_000_000_000;
const POLICY: PendingMediaClaimPolicy = { leaseMs: 12 * 60 * 1000, maxAttempts: 2 };

const { PendingMediaSchema, PendingMediaProcessingSchema } = createPendingMediaSchemas({
  fileOriginSchema: z.enum(['avatar', 'badge']),
  domainEventSchema: z.object({ type: z.literal('test.event') }).strict(),
});
type Row = z.infer<typeof PendingMediaSchema>;
type ProcessingRow = z.infer<typeof PendingMediaProcessingSchema>;

const rawBase = {
  id: 'doc-1',
  userId: 'user-1',
  fileOrigin: 'avatar',
  originalFileName: 'photo.jpg',
  pendingStoragePath: 'uploads/avatar/user-1/doc-1',
  clientContext: { surface: 'profile' },
  createdAt: NOW - 1_000,
  updatedAt: NOW - 1_000,
};

/** Parse a raw row through a real schema so the decision gets a genuine row. */
function parseRow(raw: Record<string, unknown>): Row {
  const parsed = PendingMediaSchema.safeParse(raw);
  if (!parsed.success) throw new Error(`fixture failed to parse: ${JSON.stringify(parsed.error.issues)}`);
  return parsed.data;
}

const expectedClaimWrite = (attempt: number, policy = POLICY) => ({
  status: 'processing',
  processingAttemptCount: attempt,
  processingStartedAt: NOW,
  processingLeaseExpiresAt: NOW + policy.leaseMs,
  updatedAt: NOW,
});

describe('decidePendingMediaClaim (pure state machine)', () => {
  it('claims a fresh pending row as attempt 1', () => {
    const { outcome, write } = decidePendingMediaClaim(parseRow({ ...rawBase, status: 'pending' }), NOW, POLICY);
    expect(outcome.kind).toBe('claimed');
    if (outcome.kind !== 'claimed') throw new Error('unreachable');
    expect(outcome.attempt).toBe(1);
    expect(outcome.pendingFile.status).toBe('processing');
    expect(outcome.pendingFile.fileOrigin).toBe('avatar');
    expect(write).toEqual(expectedClaimWrite(1));
  });

  it('the claimed row is the processing branch of the schema', () => {
    const { outcome } = decidePendingMediaClaim(parseRow({ ...rawBase, status: 'pending' }), NOW, POLICY);
    if (outcome.kind !== 'claimed') throw new Error('unreachable');
    // Compile-time: a claimed row is assignable to the processing branch (tsc -b checks tests).
    const processing: ProcessingRow = outcome.pendingFile;
    expect(PendingMediaProcessingSchema.safeParse(processing).success).toBe(true);
  });

  it('claims a pending row carrying a prior attempt count as the next attempt', () => {
    const current = parseRow({ ...rawBase, status: 'pending', processingAttemptCount: 1 });
    const { outcome, write } = decidePendingMediaClaim(current, NOW, POLICY);
    if (outcome.kind !== 'claimed') throw new Error('unreachable');
    expect(outcome.attempt).toBe(2);
    expect(write).toEqual(expectedClaimWrite(2));
  });

  it.each(['completed', 'failed', 'rejected'] as const)('returns terminal (no write) for a %s row', (status) => {
    const terminalRaw =
      status === 'completed'
        ? { ...rawBase, status, completedAt: NOW, terminalAt: NOW, result: { events: [] } }
        : status === 'failed'
          ? { ...rawBase, status, failedAt: NOW, terminalAt: NOW, errorCategory: 'system', errorMessage: 'x' }
          : { ...rawBase, status, rejectedAt: NOW, terminalAt: NOW, rejectionType: 'media', errorMessage: 'x' };
    const { outcome, write } = decidePendingMediaClaim(parseRow(terminalRaw), NOW, POLICY);
    expect(outcome).toEqual({ kind: 'terminal', status });
    expect(write).toBeUndefined();
  });

  it('returns busy (no write) for a processing row under a still-active explicit lease', () => {
    const current = parseRow({
      ...rawBase,
      status: 'processing',
      processingStartedAt: NOW - 1_000,
      processingAttemptCount: 1,
      processingLeaseExpiresAt: NOW + 60_000,
    });
    const { outcome, write } = decidePendingMediaClaim(current, NOW, POLICY);
    expect(outcome).toEqual({ kind: 'busy', leaseExpiresAt: NOW + 60_000 });
    expect(write).toBeUndefined();
  });

  it('reclaims a processing row with an expired lease at attempt 1 as attempt 2', () => {
    const current = parseRow({
      ...rawBase,
      status: 'processing',
      processingStartedAt: NOW - POLICY.leaseMs - 1_000,
      processingAttemptCount: 1,
      processingLeaseExpiresAt: NOW - 1_000,
    });
    const { outcome, write } = decidePendingMediaClaim(current, NOW, POLICY);
    if (outcome.kind !== 'claimed') throw new Error('unreachable');
    expect(outcome.attempt).toBe(2);
    expect(write).toEqual(expectedClaimWrite(2));
  });

  it('returns exhausted (no write) for an expired lease at the attempt ceiling', () => {
    const current = parseRow({
      ...rawBase,
      status: 'processing',
      processingStartedAt: NOW - POLICY.leaseMs - 1_000,
      processingAttemptCount: POLICY.maxAttempts,
      processingLeaseExpiresAt: NOW - 1_000,
    });
    const { outcome, write } = decidePendingMediaClaim(current, NOW, POLICY);
    expect(outcome).toEqual({ kind: 'exhausted', pendingFile: current, attempts: POLICY.maxAttempts });
    expect(write).toBeUndefined();
  });

  it('honors the injected policy: a higher ceiling reclaims where the default was exhausted', () => {
    const policy = { leaseMs: 5_000, maxAttempts: 3 };
    const current = parseRow({
      ...rawBase,
      status: 'processing',
      processingAttemptCount: 2,
      processingLeaseExpiresAt: NOW - 1,
    });
    const { outcome, write } = decidePendingMediaClaim(current, NOW, policy);
    if (outcome.kind !== 'claimed') throw new Error('unreachable');
    expect(outcome.attempt).toBe(3);
    expect(write).toEqual(expectedClaimWrite(3, policy));
  });

  describe('lease derivation for rows written before leases existed', () => {
    it('derives an ACTIVE lease from processingStartedAt when the explicit lease is absent (busy)', () => {
      const current = parseRow({ ...rawBase, status: 'processing', processingStartedAt: NOW - 1_000 });
      const { outcome, write } = decidePendingMediaClaim(current, NOW, POLICY);
      expect(outcome).toEqual({ kind: 'busy', leaseExpiresAt: NOW - 1_000 + POLICY.leaseMs });
      expect(write).toBeUndefined();
    });

    it('derives an EXPIRED lease from processingStartedAt and reclaims (count absent = attempt 1)', () => {
      const current = parseRow({ ...rawBase, status: 'processing', processingStartedAt: NOW - POLICY.leaseMs - 1_000 });
      const { outcome, write } = decidePendingMediaClaim(current, NOW, POLICY);
      if (outcome.kind !== 'claimed') throw new Error('unreachable');
      expect(outcome.attempt).toBe(2);
      expect(write).toEqual(expectedClaimWrite(2));
    });

    it('falls back to createdAt when the row lacks processingStartedAt (busy while young)', () => {
      const current = parseRow({ ...rawBase, createdAt: NOW - 1_000, status: 'processing' });
      expect(decidePendingMediaClaim(current, NOW, POLICY).outcome).toEqual({
        kind: 'busy',
        leaseExpiresAt: NOW - 1_000 + POLICY.leaseMs,
      });
    });

    it('falls back to createdAt when the row lacks processingStartedAt (reclaim when old)', () => {
      const current = parseRow({ ...rawBase, createdAt: NOW - POLICY.leaseMs - 1_000, status: 'processing' });
      const { outcome } = decidePendingMediaClaim(current, NOW, POLICY);
      if (outcome.kind !== 'claimed') throw new Error('unreachable');
      expect(outcome.attempt).toBe(2);
    });

    it('effectivePendingMediaLeaseExpiry prefers the explicit lease', () => {
      const row = { status: 'processing' as const, createdAt: 1, processingStartedAt: 2, processingLeaseExpiresAt: 99 };
      expect(effectivePendingMediaLeaseExpiry(row, POLICY)).toBe(99);
    });
  });
});

describe('decidePendingMediaFinalize (allowed-transition table)', () => {
  it('pending → applied', () => {
    expect(decidePendingMediaFinalize({ status: 'pending' }, 'completed')).toEqual({ decision: 'applied' });
  });
  it('processing → applied', () => {
    expect(decidePendingMediaFinalize({ status: 'processing' }, 'failed')).toEqual({ decision: 'applied' });
  });
  it('missing row → missing', () => {
    expect(decidePendingMediaFinalize(undefined, 'failed')).toEqual({ decision: 'missing' });
  });
  it('already the SAME terminal → idempotent noop', () => {
    expect(decidePendingMediaFinalize({ status: 'completed' }, 'completed')).toEqual({
      decision: 'noop',
      currentStatus: 'completed',
    });
  });
  it('already a DIFFERENT terminal → conflict (never overwrite)', () => {
    expect(decidePendingMediaFinalize({ status: 'completed' }, 'failed')).toEqual({
      decision: 'conflict',
      currentStatus: 'completed',
    });
    expect(decidePendingMediaFinalize({ status: 'rejected' }, 'failed')).toEqual({
      decision: 'conflict',
      currentStatus: 'rejected',
    });
  });
  it('a row with no status is not transitionable → conflict', () => {
    expect(decidePendingMediaFinalize({}, 'failed')).toEqual({ decision: 'conflict' });
  });
});

describe('buildPendingMediaTerminalFields', () => {
  it('completed sets completedAt + terminalAt + updatedAt and merges extra', () => {
    expect(buildPendingMediaTerminalFields('completed', { result: { events: [] } }, 1000)).toEqual({
      status: 'completed',
      completedAt: 1000,
      terminalAt: 1000,
      updatedAt: 1000,
      result: { events: [] },
    });
  });
  it('failed sets failedAt (not completedAt/rejectedAt)', () => {
    const fields = buildPendingMediaTerminalFields('failed', { errorCategory: 'system', errorMessage: 'x' }, 5);
    expect(fields).toMatchObject({ status: 'failed', failedAt: 5, terminalAt: 5, updatedAt: 5, errorCategory: 'system' });
    expect(fields).not.toHaveProperty('completedAt');
    expect(fields).not.toHaveProperty('rejectedAt');
  });
  it('rejected sets rejectedAt', () => {
    expect(buildPendingMediaTerminalFields('rejected', {}, 7)).toMatchObject({ status: 'rejected', rejectedAt: 7 });
  });
  it('a terminal row built from these fields parses as that branch', () => {
    const processingRow = { ...rawBase, status: 'processing' };
    const row = {
      ...processingRow,
      ...buildPendingMediaTerminalFields('failed', { errorCategory: 'system', errorMessage: 'boom' }, NOW),
    };
    expect(PendingMediaSchema.safeParse(row).success).toBe(true);
  });

  it('with no extra fields each status returns exactly its literal field set', () => {
    expect(buildPendingMediaTerminalFields('completed', {}, 1)).toStrictEqual({
      status: 'completed', completedAt: 1, terminalAt: 1, updatedAt: 1,
    });
    expect(buildPendingMediaTerminalFields('failed', {}, 2)).toStrictEqual({
      status: 'failed', failedAt: 2, terminalAt: 2, updatedAt: 2,
    });
    expect(buildPendingMediaTerminalFields('rejected', {}, 3)).toStrictEqual({
      status: 'rejected', rejectedAt: 3, terminalAt: 3, updatedAt: 3,
    });
  });

  it("the status's own *At stamp is written after the extra fields", () => {
    expect(buildPendingMediaTerminalFields('completed', { completedAt: 1 }, 9).completedAt).toBe(9);
  });

  it('declares the literal field set per status, and the set merged with extra fields', () => {
    expectTypeOf(buildPendingMediaTerminalFields('completed', {}, 1)).toEqualTypeOf<PendingMediaCompletedTerminalFields>();
    expectTypeOf(buildPendingMediaTerminalFields('failed', {}, 1)).toEqualTypeOf<PendingMediaFailedTerminalFields>();
    expectTypeOf(buildPendingMediaTerminalFields('rejected', {}, 1)).toEqualTypeOf<PendingMediaRejectedTerminalFields>();
    expectTypeOf(buildPendingMediaTerminalFields('failed', { errorMessage: 'x' }, 1)).toEqualTypeOf<
      PendingMediaFailedTerminalFields & { errorMessage: string }
    >();
    const anyStatus = 'rejected' as PendingMediaTerminalStatus;
    const either: PendingMediaTerminalFields = buildPendingMediaTerminalFields(anyStatus, {}, 1);
    expect(either.status).toBe('rejected');
    // @ts-expect-error — a completed field set has no failedAt
    expect(buildPendingMediaTerminalFields('completed', {}, 1).failedAt).toBeUndefined();
  });

  // A static reader of the shipped declarations (one that reads a function's declared
  // return type, not the code) can list the keys only when the first declared signature
  // names a plain object type — never an intersection, conditional, or index signature.
  it('its first declared signature names the literal completed field set as a plain object type', () => {
    const file = path.resolve(__dirname, '../src/pending-media-lifecycle.ts');
    const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
    const signatures: ts.FunctionDeclaration[] = [];
    const aliases = new Map<string, ts.TypeAliasDeclaration>();
    source.forEachChild((node) => {
      if (ts.isFunctionDeclaration(node) && node.name?.text === 'buildPendingMediaTerminalFields') signatures.push(node);
      if (ts.isTypeAliasDeclaration(node)) aliases.set(node.name.text, node);
    });
    const returned = signatures[0]?.type;
    expect(returned && ts.isTypeReferenceNode(returned) && ts.isIdentifier(returned.typeName)).toBe(true);
    const alias = aliases.get(((returned as ts.TypeReferenceNode).typeName as ts.Identifier).text);
    expect(alias && ts.isTypeLiteralNode(alias.type)).toBe(true);
    const keys = (alias!.type as ts.TypeLiteralNode).members.map((member) =>
      ts.isPropertySignature(member) && ts.isIdentifier(member.name) ? member.name.text : '(not a plain key)',
    );
    expect(keys).toEqual(['status', 'completedAt', 'terminalAt', 'updatedAt']);
  });
});

describe('isPendingMediaTerminalStatus', () => {
  it('is true only for the three terminal statuses', () => {
    expect(['completed', 'failed', 'rejected'].every(isPendingMediaTerminalStatus)).toBe(true);
    expect([undefined, 'pending', 'processing', 'weird'].some(isPendingMediaTerminalStatus)).toBe(false);
  });
});
