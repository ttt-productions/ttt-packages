import { describe, it, expect } from 'vitest';
import {
  ADMIN_TASK_RESOLUTION_OWNERS,
  ADMIN_TASK_RESOLUTION_OWNER_BY_TYPE,
  isAdminTaskResolvedByCheckin,
} from '../src/constants/business-admin';
import { AdminTaskTypeSchema } from '../src/doc-schemas/report-docs';
import * as root from '../src/index';
import { REPORT_TASK_QUEUES } from '../src/report/report-config-values';

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

describe('the failed pledge refund task', () => {
  it('is resolved by the refund decision, never a generic check-in — resolving it reopens the pledge to new requests', () => {
    expect(AdminTaskTypeSchema.options).toContain('pledgeRefundFailed');
    expect(ADMIN_TASK_RESOLUTION_OWNER_BY_TYPE.pledgeRefundFailed).toBe('refundDecision');
    expect(isAdminTaskResolvedByCheckin('pledgeRefundFailed')).toBe(false);
  });

  it('has its own queue beside the refund requests, with the refund-request windows', () => {
    expect(REPORT_TASK_QUEUES.pledgeRefundFailed).toEqual({
      displayName: 'Failed Pledge Refunds',
      description: 'Approved pledge refunds that Stripe reported as failed',
      defaultCheckoutMinutes: REPORT_TASK_QUEUES.pledgeRefundRequested.defaultCheckoutMinutes,
      workLaterMinutes: REPORT_TASK_QUEUES.pledgeRefundRequested.workLaterMinutes,
      maxWorkLaterMinutes: REPORT_TASK_QUEUES.pledgeRefundRequested.maxWorkLaterMinutes,
    });
    const order = Object.keys(REPORT_TASK_QUEUES);
    expect(order.indexOf('pledgeRefundFailed')).toBe(order.indexOf('pledgeRefundRequested') + 1);
  });

  it('every admin task type has a queue', () => {
    for (const taskType of AdminTaskTypeSchema.options) {
      expect(REPORT_TASK_QUEUES[taskType], taskType).toBeDefined();
    }
  });
});
