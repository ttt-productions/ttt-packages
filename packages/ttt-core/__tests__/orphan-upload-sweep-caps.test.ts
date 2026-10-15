import { describe, it, expect } from 'vitest';
import {
  ORPHAN_UPLOAD_DELETE_CAP,
  ORPHAN_UPLOAD_EXAMINED_CAP,
  ORPHAN_UPLOAD_LIST_PAGE_SIZE,
} from '../src/constants/retention.js';

describe('orphan-upload sweep caps', () => {
  it('examines whole listing pages, so a pass never stops partway through a page it fetched', () => {
    expect(ORPHAN_UPLOAD_EXAMINED_CAP % ORPHAN_UPLOAD_LIST_PAGE_SIZE).toBe(0);
    expect(ORPHAN_UPLOAD_EXAMINED_CAP).toBeGreaterThan(0);
  });

  it('lets a pass reach its delete cap before its examined cap when everything it sees is an orphan', () => {
    expect(ORPHAN_UPLOAD_EXAMINED_CAP).toBeGreaterThanOrEqual(ORPHAN_UPLOAD_DELETE_CAP);
  });
});
