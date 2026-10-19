import { describe, it, expect } from 'vitest';
import {
  ADMIN_TASK_RESOLUTION_OWNER_BY_TYPE,
  isAdminTaskResolvedByCheckin,
} from '../src/constants/business-admin';
import * as constants from '../src/constants/index';

describe('admin-task resolution owners', () => {
  it('is exported from the constants entry', () => {
    expect(constants.isAdminTaskResolvedByCheckin).toBe(isAdminTaskResolvedByCheckin);
    expect(constants.ADMIN_TASK_RESOLUTION_OWNER_BY_TYPE).toBe(ADMIN_TASK_RESOLUTION_OWNER_BY_TYPE);
  });
});
