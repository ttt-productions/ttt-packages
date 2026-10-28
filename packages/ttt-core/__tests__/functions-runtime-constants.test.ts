import { describe, it, expect } from 'vitest';
import { FUNCTIONS_REQUEST_TIMEOUT_SECONDS } from '../src/constants/functions-runtime.js';

describe('FUNCTIONS_REQUEST_TIMEOUT_SECONDS', () => {
  it('outlasts Cloud Run’s 60s default, so a slow cold start still serves the CORS preflight', () => {
    expect(FUNCTIONS_REQUEST_TIMEOUT_SECONDS).toBeGreaterThan(60);
  });

  it('stays within the 3600s a Cloud Functions HTTP request may run', () => {
    expect(Number.isInteger(FUNCTIONS_REQUEST_TIMEOUT_SECONDS)).toBe(true);
    expect(FUNCTIONS_REQUEST_TIMEOUT_SECONDS).toBeLessThanOrEqual(3600);
  });
});
