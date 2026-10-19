import { describe, it, expect } from 'vitest';
import { TTT_TELEMETRY_CONTENT_POLICY } from '../src/constants/telemetry-content-policy';
import * as constants from '../src/constants/index';

describe('TTT_TELEMETRY_CONTENT_POLICY', () => {
  it('is importable from the server-safe constants entry, where the Functions tree and the Next inits read it', () => {
    expect(constants.TTT_TELEMETRY_CONTENT_POLICY).toBe(TTT_TELEMETRY_CONTENT_POLICY);
  });
});
