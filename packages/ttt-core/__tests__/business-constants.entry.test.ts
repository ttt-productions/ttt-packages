import { describe, it, expect } from 'vitest';
import * as constants from '../src/constants/index';

describe('admin Dispatches browse page size', () => {
  it('is importable from the server-safe constants entry, where the browse list reads it', () => {
    expect(constants.ITEMS_PER_PAGE_ADMIN_DISPATCH_BROWSE).toBe(12);
  });
});

describe('admin task browse page size', () => {
  it('is 12 tasks a page, read from the server-safe constants entry by the task browse list', () => {
    expect(constants.ITEMS_PER_PAGE_ADMIN_TASK_BROWSE).toBe(12);
  });
});

describe('the tray Safety Cases count', () => {
  it('shows an exact count up to 100 and "100+" once more than 100 cases are open', () => {
    expect(constants.formatSafetyCaseTrayCount(99)).toBe('99');
    expect(constants.formatSafetyCaseTrayCount(100)).toBe('100');
    expect(constants.formatSafetyCaseTrayCount(101)).toBe('100+');
  });

  it('reads one case past the cap, so 100 open cases are told apart from more', () => {
    expect(constants.SAFETY_CASE_TRAY_READ_LIMIT).toBe(101);
  });
});
