import { describe, it, expect } from 'vitest';
import {
  hallContentChangeRequestTargetKey,
  workRealmChangeRequestTargetKey,
} from '../src/utils/hall-content';
import {
  HallContentChangeRequestSchema,
  hallContentChangeRequestTargetKeySchema,
} from '../src/doc-schemas/content';
import { HallContentChangeRequestApprovedEventSchema } from '../src/media/domain-events-admin';
import { FIRESTORE_INDEXED_VALUE_MAX_BYTES } from '../src/constants/business-platform';

// Stored requests are found again by these exact bytes, so the builders must keep them.
describe('change-request target keys', () => {
  it('keys a Hall item detail request as `<hallItemId>_detail`', () => {
    expect(hallContentChangeRequestTargetKey('hall1')).toBe('hall1_detail');
    expect(hallContentChangeRequestTargetKey('hall1', null)).toBe('hall1_detail');
  });

  it('keys a sub-item request as `<hallItemId>_<subItemId>`', () => {
    expect(hallContentChangeRequestTargetKey('hall1', 'chapter9')).toBe('hall1_chapter9');
  });

  it('keys a Realm request as `realm_<workRealmId>`', () => {
    expect(workRealmChangeRequestTargetKey('realm7')).toBe('realm_realm7');
  });

  it('keeps a detail key and a sub-item key for one Hall item apart', () => {
    expect(hallContentChangeRequestTargetKey('h')).not.toBe(hallContentChangeRequestTargetKey('h', 's'));
  });
});

describe('the stored target key bound', () => {
  it('accepts every key the builders produce for ordinary ids', () => {
    for (const key of [
      hallContentChangeRequestTargetKey('abc'),
      hallContentChangeRequestTargetKey('abc', 'def'),
      workRealmChangeRequestTargetKey('ghi'),
    ]) {
      expect(hallContentChangeRequestTargetKeySchema.safeParse(key).success).toBe(true);
    }
  });

  it('refuses an empty key', () => {
    expect(hallContentChangeRequestTargetKeySchema.safeParse('').success).toBe(false);
  });

  it('refuses a key longer than Firestore indexes exactly, counted in bytes', () => {
    expect(hallContentChangeRequestTargetKeySchema.safeParse('a'.repeat(FIRESTORE_INDEXED_VALUE_MAX_BYTES)).success).toBe(true);
    expect(hallContentChangeRequestTargetKeySchema.safeParse('a'.repeat(FIRESTORE_INDEXED_VALUE_MAX_BYTES + 1)).success).toBe(false);
    // 'é' is two UTF-8 bytes.
    expect(hallContentChangeRequestTargetKeySchema.safeParse('é'.repeat(FIRESTORE_INDEXED_VALUE_MAX_BYTES / 2 + 1)).success).toBe(false);
  });

  it('is the bound the stored request doc declares', () => {
    const request = {
      changeRequestId: 'cr1',
      requestKind: 'text',
      targetKey: '',
      hallItemId: 'h',
      workProjectId: 'w',
      workProjectType: 'Tales',
      surface: 'tale',
      workRealmId: null,
      subItemId: null,
      proposerUid: 'u',
      proposedFields: { title: 'New' },
      status: 'requested',
      createdAt: 1,
      lastUpdatedAt: 1,
    };
    expect(HallContentChangeRequestSchema.safeParse(request).success).toBe(false);
    expect(
      HallContentChangeRequestSchema.safeParse({ ...request, targetKey: hallContentChangeRequestTargetKey('h') }).success,
    ).toBe(true);
  });
});

describe('the approved-request event', () => {
  it('carries the Hall item and sub-item on a Hall-grain approval', () => {
    const parsed = HallContentChangeRequestApprovedEventSchema.safeParse({
      type: 'hallContentChangeRequest.approved',
      ids: { workProjectId: 'w', hallItemId: 'h', subItemId: 's' },
    });
    expect(parsed.success).toBe(true);
  });

  it('still carries a Realm-grain approval with no Hall ids', () => {
    const parsed = HallContentChangeRequestApprovedEventSchema.safeParse({
      type: 'hallContentChangeRequest.approved',
      ids: { workProjectId: 'w', workRealmId: 'r' },
    });
    expect(parsed.success).toBe(true);
  });

  it('refuses an empty Hall id and an id it does not declare', () => {
    const base = { type: 'hallContentChangeRequest.approved' as const };
    expect(HallContentChangeRequestApprovedEventSchema.safeParse({ ...base, ids: { workProjectId: 'w', hallItemId: '' } }).success).toBe(false);
    expect(HallContentChangeRequestApprovedEventSchema.safeParse({ ...base, ids: { workProjectId: 'w', chapterId: 'c' } }).success).toBe(false);
  });
});
