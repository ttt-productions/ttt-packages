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
    expect(toPath(['userProfiles', 'user123', 'profileSkills', 'skill456'])).toBe(
      'userProfiles/user123/profileSkills/skill456'
    );
  });

  it('works with PATH_BUILDERS.userProfile output', () => {
    expect(toPath(PATH_BUILDERS.userProfile('user123'))).toBe('userProfiles/user123');
  });

  it('works with PATH_BUILDERS.project output', () => {
    expect(toPath(PATH_BUILDERS.project('proj456'))).toBe('allProjects/proj456');
  });

  it('works with PATH_BUILDERS.chatChannel output', () => {
    expect(toPath(PATH_BUILDERS.chatChannel('projABC', 'chanXYZ'))).toBe(
      'allProjects/projABC/chatChannels/chanXYZ'
    );
  });

  it('works with PATH_BUILDERS.channelMessage output (6-segment path)', () => {
    expect(toPath(PATH_BUILDERS.channelMessage('p1', 'c1', 'm1'))).toBe(
      'allProjects/p1/chatChannels/c1/channelMessages/m1'
    );
  });
});
