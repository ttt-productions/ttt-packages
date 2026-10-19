import { describe, it, expect } from 'vitest';
import { MEDIA_SWEEP_BACKOFF_BASE_MS, MEDIA_SWEEP_BACKOFF_MAX_MS } from '../src/constants/media.js';
import * as constants from '../src/constants/index.js';

describe('the media sweep deferral backoff', () => {
  it('is importable from the constants entry', () => {
    expect(constants.MEDIA_SWEEP_BACKOFF_BASE_MS).toBe(MEDIA_SWEEP_BACKOFF_BASE_MS);
    expect(constants.MEDIA_SWEEP_BACKOFF_MAX_MS).toBe(MEDIA_SWEEP_BACKOFF_MAX_MS);
  });
});
