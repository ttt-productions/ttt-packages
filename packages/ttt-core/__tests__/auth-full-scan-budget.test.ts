import { describe, it, expect } from 'vitest';
import {
  AUTH_FULL_SCAN_EXAMINED_PER_RUN,
  AUTH_LIST_USERS_PAGE_SIZE,
} from '../src/constants/scheduled-jobs.js';

describe('Auth full-scan budget', () => {
  it('examines whole listUsers pages, so a run stops only where a saved page token can resume it', () => {
    expect(AUTH_FULL_SCAN_EXAMINED_PER_RUN % AUTH_LIST_USERS_PAGE_SIZE).toBe(0);
    expect(AUTH_FULL_SCAN_EXAMINED_PER_RUN).toBeGreaterThan(0);
  });

  it('asks for no more accounts per page than Firebase Auth returns in one call', () => {
    expect(AUTH_LIST_USERS_PAGE_SIZE).toBeLessThanOrEqual(1000);
    expect(AUTH_LIST_USERS_PAGE_SIZE).toBeGreaterThan(0);
  });
});
