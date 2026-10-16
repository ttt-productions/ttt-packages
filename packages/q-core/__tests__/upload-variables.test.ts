// The upload mutations' variables: each hook parses them before it stages anything, so a target that
// does not fit its origin, a file or drawing that is not one, or a malformed signing subject never
// reaches the staging call.

import { describe, it, expect } from 'vitest';
import { PICTURE_ORIGIN_KEYS } from '../src/media/file-origins';
import {
  PictureUploadVariablesSchema,
  SignHardwareContractVariablesSchema,
  SignWaiverVariablesSchema,
} from '../src/upload-variables';

const file = new File(['x'], 'picture.png', { type: 'image/png' });

const TARGET_BY_ORIGIN = {
  'league-picture': { leagueId: 'league-1' },
  'team-picture': { teamId: 'team-1' },
  'landing-picture': {},
  'location-picture': { gameLocationId: 'location-1' },
  'award-badge': { awardId: 'award-1' },
} as const;

describe('PictureUploadVariablesSchema', () => {
  it("takes every origin's own target", () => {
    for (const origin of PICTURE_ORIGIN_KEYS) {
      const target = { origin, targetInfo: TARGET_BY_ORIGIN[origin] };
      expect(PictureUploadVariablesSchema.safeParse({ target, file }).success, origin).toBe(true);
    }
    expect(
      PictureUploadVariablesSchema.safeParse({ target: { origin: 'award-badge', targetInfo: { newAwardName: 'MVP' } }, file }).success,
    ).toBe(true);
  });

  it('carries the optional claim, progress callback, and abort signal', () => {
    const target = { origin: 'team-picture', targetInfo: { teamId: 'team-1' } };
    const variables = {
      target,
      file,
      claim: { kind: 'image', source: 'file-picker' },
      onProgress: () => undefined,
      signal: new AbortController().signal,
    };
    expect(PictureUploadVariablesSchema.safeParse(variables).success).toBe(true);
    expect(PictureUploadVariablesSchema.safeParse({ ...variables, onProgress: 'progress' }).success).toBe(false);
  });

  it("refuses a target whose targetInfo does not fit its origin", () => {
    expect(
      PictureUploadVariablesSchema.safeParse({ target: { origin: 'team-picture', targetInfo: { leagueId: 'league-1' } }, file }).success,
    ).toBe(false);
    expect(PictureUploadVariablesSchema.safeParse({ target: { origin: 'avatar', targetInfo: {} }, file }).success).toBe(false);
  });

  it('refuses a missing file and one that is not a File', () => {
    const target = { origin: 'landing-picture', targetInfo: {} };
    expect(PictureUploadVariablesSchema.safeParse({ target }).success).toBe(false);
    expect(PictureUploadVariablesSchema.safeParse({ target, file: new Blob(['x']) }).success).toBe(false);
  });

  it('refuses an unknown key', () => {
    const target = { origin: 'landing-picture', targetInfo: {} };
    expect(PictureUploadVariablesSchema.safeParse({ target, file, storagePath: 'uploads/x' }).success).toBe(false);
  });
});

const drawing = new Blob(['x'], { type: 'image/png' });
const displayed = { leagueId: 'league-1', waiverTemplateId: 'template-1', waiverTemplateVersion: 2 };

describe('SignWaiverVariablesSchema', () => {
  it("takes the signer's own waiver, and a ghost's through either entry", () => {
    expect(SignWaiverVariablesSchema.safeParse({ ...displayed, signature: drawing, subject: { kind: 'self' } }).success).toBe(true);
    for (const entry of ['member', 'admin']) {
      const subject = { kind: 'ghost', ghostUserId: 'ghost-1', teamId: 'team-1', entry };
      expect(SignWaiverVariablesSchema.safeParse({ ...displayed, signature: drawing, subject }).success, entry).toBe(true);
    }
  });

  it('refuses a ghost subject without its team or entry, and an entry that is neither', () => {
    const ghost = { kind: 'ghost', ghostUserId: 'ghost-1', teamId: 'team-1', entry: 'member' };
    const { teamId: _teamId, ...noTeam } = ghost;
    const { entry: _entry, ...noEntry } = ghost;
    for (const subject of [noTeam, noEntry, { ...ghost, entry: 'referee' }]) {
      expect(SignWaiverVariablesSchema.safeParse({ ...displayed, signature: drawing, subject }).success).toBe(false);
    }
  });

  it('refuses a missing drawing, one that is not a Blob, and a missing displayed version', () => {
    const subject = { kind: 'self' };
    expect(SignWaiverVariablesSchema.safeParse({ ...displayed, subject }).success).toBe(false);
    expect(SignWaiverVariablesSchema.safeParse({ ...displayed, signature: 'data:image/png;base64,', subject }).success).toBe(false);
    const { waiverTemplateVersion: _version, ...noVersion } = displayed;
    expect(SignWaiverVariablesSchema.safeParse({ ...noVersion, signature: drawing, subject }).success).toBe(false);
  });

  it('refuses an unknown key', () => {
    const variables = { ...displayed, signature: drawing, subject: { kind: 'self' }, storagePath: 'uploads/x' };
    expect(SignWaiverVariablesSchema.safeParse(variables).success).toBe(false);
  });
});

describe('SignHardwareContractVariablesSchema', () => {
  it('takes a contract and its drawing', () => {
    expect(SignHardwareContractVariablesSchema.safeParse({ contractId: 'contract-1', signature: drawing }).success).toBe(true);
  });

  it('refuses a missing contract, a drawing that is not a Blob, and an unknown key', () => {
    expect(SignHardwareContractVariablesSchema.safeParse({ signature: drawing }).success).toBe(false);
    expect(SignHardwareContractVariablesSchema.safeParse({ contractId: 'contract-1', signature: 'x' }).success).toBe(false);
    expect(
      SignHardwareContractVariablesSchema.safeParse({ contractId: 'contract-1', signature: drawing, storagePath: 'uploads/x' }).success,
    ).toBe(false);
  });
});
