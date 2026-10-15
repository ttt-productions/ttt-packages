// The picture upload mutation's variables: the hook parses them before it stages anything, so a target
// that does not fit its origin, or a file that is not one, never reaches the staging call.

import { describe, it, expect } from 'vitest';
import { PICTURE_ORIGIN_KEYS } from '../src/media/file-origins';
import { PictureUploadVariablesSchema } from '../src/upload-variables';

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
