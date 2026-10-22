import { describe, it, expect } from 'vitest';
import {
  parseSafetyHoldRefDocId,
  safetyHoldRefDocId,
  thresholdItemDocId,
} from '../src/paths/compound-ids.js';
import * as paths from '../src/paths/index.js';
import { parseNotificationFanoutJobDocId } from '../src/paths/notification-fanout-job-ids.js';

describe('the paths entry', () => {
  it('carries the compound id builders and parsers', () => {
    expect(paths.safetyHoldRefDocId).toBe(safetyHoldRefDocId);
    expect(paths.parseSafetyHoldRefDocId).toBe(parseSafetyHoldRefDocId);
    expect(paths.thresholdItemDocId).toBe(thresholdItemDocId);
    expect(paths.parseNotificationFanoutJobDocId).toBe(parseNotificationFanoutJobDocId);
  });
});
