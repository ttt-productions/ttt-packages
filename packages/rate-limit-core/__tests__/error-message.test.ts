import { describe, it, expect } from 'vitest';
import { getRateLimitErrorMessage } from '../src/error-message.js';

describe('getRateLimitErrorMessage', () => {
  const now = Date.now();

  it('default message without context matches expected shape', () => {
    const reset = now + 5 * 60_000;
    const msg = getRateLimitErrorMessage({ reset });
    expect(msg).toBe('Rate limit exceeded. Try again in 5 minutes.');
  });

  it('uses singular "1 minute" for short windows', () => {
    const reset = now + 30_000; // 30 seconds → ceil to 1 minute
    const msg = getRateLimitErrorMessage({ reset });
    expect(msg).toContain('1 minute');
    expect(msg).not.toMatch(/\d+ minutes/);
  });

  it('uses plural "N minutes" for N > 1', () => {
    const reset = now + 3 * 60_000;
    const msg = getRateLimitErrorMessage({ reset });
    expect(msg).toContain('3 minutes');
  });

  it('clamps reset time in the past to "1 minute"', () => {
    const reset = now - 10_000;
    const msg = getRateLimitErrorMessage({ reset });
    expect(msg).toContain('1 minute');
    expect(msg).not.toMatch(/0 minutes/);
  });

  it('prefixes context when provided', () => {
    const reset = now + 2 * 60_000;
    const msg = getRateLimitErrorMessage({ reset, context: 'Upload' });
    expect(msg).toBe('Upload rate limit exceeded. Try again in 2 minutes.');
  });

  it('appends suffix after a space when copy.suffix is provided', () => {
    const reset = now + 2 * 60_000;
    const msg = getRateLimitErrorMessage({
      reset,
      copy: { suffix: 'Early-launch rate limits in place.' },
    });
    expect(msg).toBe('Rate limit exceeded. Try again in 2 minutes. Early-launch rate limits in place.');
  });

  it('copy.format overrides default formatting entirely', () => {
    const reset = now + 3 * 60_000;
    const msg = getRateLimitErrorMessage({
      reset,
      context: 'Upload',
      copy: {
        format: ({ timeString, context }) => `Custom: ${context} — wait ${timeString}`,
      },
    });
    expect(msg).toBe('Custom: Upload — wait 3 minutes');
  });
});
