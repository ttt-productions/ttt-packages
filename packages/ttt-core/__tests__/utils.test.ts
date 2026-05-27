import { describe, it, expect } from 'vitest';
import { toPath } from '../src/paths/utils';
import { PATH_BUILDERS } from '../src/paths/path-builders';

describe('toPath', () => {
  it('returns empty string for empty array', () => {
    expect(toPath([])).toBe('');
  });

  it('returns the segment for a single-element array', () => {
    expect(toPath(['userProfiles'])).toBe('userProfiles');
  });

  it('joins two segments with a forward slash', () => {
    expect(toPath(['userProfiles', 'user123'])).toBe('userProfiles/user123');
  });

  it('joins multiple segments with forward slashes', () => {
    expect(toPath(['userProfiles', 'user123', 'profileCraftSkills', 'skill456'])).toBe(
      'userProfiles/user123/profileCraftSkills/skill456'
    );
  });

  it('works with PATH_BUILDERS.userProfile output', () => {
    expect(toPath(PATH_BUILDERS.userProfile('user123'))).toBe('userProfiles/user123');
  });

  it('works with PATH_BUILDERS.workProject output', () => {
    expect(toPath(PATH_BUILDERS.workProject('proj456'))).toBe('allWorkProjects/proj456');
  });

  it('works with PATH_BUILDERS.guildChatChannel output', () => {
    expect(toPath(PATH_BUILDERS.guildChatChannel('projABC', 'chanXYZ'))).toBe(
      'allWorkProjects/projABC/guildChatChannels/chanXYZ'
    );
  });

  it('works with PATH_BUILDERS.guildChatMessage output (6-segment path)', () => {
    expect(toPath(PATH_BUILDERS.guildChatMessage('p1', 'c1', 'm1'))).toBe(
      'allWorkProjects/p1/guildChatChannels/c1/guildChatMessages/m1'
    );
  });
});


