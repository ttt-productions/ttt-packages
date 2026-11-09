import { describe, expect, it } from 'vitest';
import { MEDIA_SIZE_MAX_DENSITY, mediaSizeNeed, pickMediaSize } from '../src/media-size.js';

const SIZES = [
  { key: 'lg', width: 2400 },
  { key: 'sm', width: 720 },
  { key: 'md', width: 1440 },
];

describe('the size a spot needs', () => {
  it('counts the pixel density up to 2×, and never below 1×', () => {
    expect(MEDIA_SIZE_MAX_DENSITY).toBe(2);
    expect(mediaSizeNeed(390, 3)).toBe(780);
    expect(mediaSizeNeed(390, 2)).toBe(780);
    expect(mediaSizeNeed(390, 1.5)).toBe(585);
    expect(mediaSizeNeed(390, 0.5)).toBe(390);
  });
});

describe('picking a stored size', () => {
  it('takes the smallest size at least as wide as the need', () => {
    expect(pickMediaSize(SIZES, 700)?.key).toBe('sm');
    expect(pickMediaSize(SIZES, 720)?.key).toBe('sm');
    expect(pickMediaSize(SIZES, 780)?.key).toBe('md');
    expect(pickMediaSize(SIZES, 1441)?.key).toBe('lg');
  });

  it('takes the largest size when even that is narrower than the need', () => {
    expect(pickMediaSize(SIZES, 5000)?.key).toBe('lg');
  });

  it('has nothing to pick from no sizes', () => {
    expect(pickMediaSize([], 100)).toBeNull();
  });
});
