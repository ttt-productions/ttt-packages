import { describe, it, expect } from 'vitest';
import {
  ADMIN_TASK_RESOLUTION_OWNERS,
  ADMIN_TASK_RESOLUTION_OWNER_BY_TYPE,
  isAdminTaskResolvedByCheckin,
} from '../src/constants/business-admin';
import { AdminTaskTypeSchema } from '../src/doc-schemas/report-docs';
import * as root from '../src/index';

describe('admin-task resolution owners', () => {
  it('classifies every admin task type, and only those', () => {
    expect(Object.keys(ADMIN_TASK_RESOLUTION_OWNER_BY_TYPE).sort()).toEqual([...AdminTaskTypeSchema.options].sort());
    for (const owner of Object.values(ADMIN_TASK_RESOLUTION_OWNER_BY_TYPE)) {
      expect(ADMIN_TASK_RESOLUTION_OWNERS).toContain(owner);
    }
  });

  it('lets a generic check-in resolve only the task types that carry no decision of their own', () => {
    const resolvedByCheckin = AdminTaskTypeSchema.options.filter(isAdminTaskResolvedByCheckin).sort();
    expect(resolvedByCheckin).toEqual(
      ['pledgeDisputeOpened', 'pledgeLedgerAnomaly', 'pledgePaymentRepairNeeded', 'stakeShareAnomaly'].sort(),
    );
  });

  it('refuses a generic check-in for every decision-bearing task type', () => {
    for (const taskType of [
      'userReport',
      'thresholdLibraryReview',
      'content-appeal',
      'pledgeRefundRequested',
      'hallContentChangeRequest',
      'adminDispatch',
    ]) {
      expect(isAdminTaskResolvedByCheckin(taskType)).toBe(false);
    }
  });

  it('fails closed on a stored task type it does not know', () => {
    expect(isAdminTaskResolvedByCheckin('notATaskType')).toBe(false);
    expect(isAdminTaskResolvedByCheckin('')).toBe(false);
    expect(isAdminTaskResolvedByCheckin('toString')).toBe(false);
    expect(isAdminTaskResolvedByCheckin('__proto__')).toBe(false);
  });

  it('is exported from the package root', () => {
    expect(root.isAdminTaskResolvedByCheckin).toBe(isAdminTaskResolvedByCheckin);
    expect(root.ADMIN_TASK_RESOLUTION_OWNER_BY_TYPE).toBe(ADMIN_TASK_RESOLUTION_OWNER_BY_TYPE);
  });
});
