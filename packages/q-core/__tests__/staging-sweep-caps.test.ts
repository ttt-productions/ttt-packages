import { describe, it, expect } from 'vitest';
import {
  MAX_STAGING_DELETES_PER_RUN,
  MAX_STAGING_EXAMINED_PER_RUN,
  STAGING_LIST_PAGE_SIZE,
} from '../src/constants/media.js';

describe('abandoned-staging pass caps', () => {
  it('examines whole listing pages, so a pass never stops partway through a page it fetched', () => {
    expect(MAX_STAGING_EXAMINED_PER_RUN % STAGING_LIST_PAGE_SIZE).toBe(0);
    expect(MAX_STAGING_EXAMINED_PER_RUN).toBeGreaterThan(0);
  });

  it('lets a pass reach its delete cap before its examined cap when everything it sees is abandoned', () => {
    expect(MAX_STAGING_EXAMINED_PER_RUN).toBeGreaterThanOrEqual(MAX_STAGING_DELETES_PER_RUN);
  });
});
