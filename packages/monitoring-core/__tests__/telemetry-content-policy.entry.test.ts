import { describe, it, expect } from 'vitest';
import { createTelemetryContentPolicy, DEFAULT_SDK_CONTEXTS } from '../src/telemetry-content-policy';
import * as root from '../src/index';

describe('createTelemetryContentPolicy', () => {
  it('is exported from the server-safe root', () => {
    expect(root.createTelemetryContentPolicy).toBe(createTelemetryContentPolicy);
    expect(root.DEFAULT_SDK_CONTEXTS).toBe(DEFAULT_SDK_CONTEXTS);
  });
});
