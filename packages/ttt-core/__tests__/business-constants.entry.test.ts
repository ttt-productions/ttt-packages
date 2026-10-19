import { describe, it, expect } from 'vitest';
import {
  ITEMS_PER_PAGE_ADMIN_DISPATCH_BROWSE,
  ITEMS_PER_PAGE_ADMIN_TASK_BROWSE,
} from '../src/constants/pagination.js';
import * as constants from '../src/constants/index.js';

describe('admin Dispatches browse page size', () => {
  it('is importable from the server-safe constants entry, where the browse list reads it', () => {
    expect(constants.ITEMS_PER_PAGE_ADMIN_DISPATCH_BROWSE).toBe(
      ITEMS_PER_PAGE_ADMIN_DISPATCH_BROWSE,
    );
  });
});

describe('admin task browse page size', () => {
  it('is read from the server-safe constants entry by the task browse list', () => {
    expect(constants.ITEMS_PER_PAGE_ADMIN_TASK_BROWSE).toBe(ITEMS_PER_PAGE_ADMIN_TASK_BROWSE);
  });
});
