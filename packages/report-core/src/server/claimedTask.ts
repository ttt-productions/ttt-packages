import type { AdminTaskStatus, CheckoutDetails, ClaimedTask } from '../types-admin-task.js';

/**
 * The one shape both checkout handlers answer with. The task document is read from Firestore
 * untyped; its fields are the ones every admin task document is written with.
 */
export function toClaimedTask(
  id: string,
  taskData: Record<string, unknown>,
  status: AdminTaskStatus,
  checkoutDetails: CheckoutDetails,
  itemData: unknown,
): ClaimedTask {
  return {
    id,
    taskType: taskData.taskType as string,
    taskId: taskData.taskId as string,
    originalPath: taskData.originalPath as string,
    summary: taskData.summary as string,
    priority: taskData.priority as number,
    checkedOutAt: checkoutDetails.checkedOutAt,
    expiresAt: checkoutDetails.expiresAt,
    status,
    checkoutDetails,
    itemData,
  };
}
