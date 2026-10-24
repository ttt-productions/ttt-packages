import {
  TASK_PRIORITY,
  TASK_PRIORITY_LEVEL_TO_SCORE,
  type TaskPriorityLevel,
  type TaskPriorityScore,
} from '../constants/business-admin.js';
import type { ThresholdItem } from '../doc-schemas/content.js';
import type { AdminDispatch } from '../doc-schemas/messaging.js';
import type { ContentAppealTask } from '../doc-schemas/moderation.js';
import {
  AdminTaskStatusSchema,
  type AdminTaskDoc,
  type AdminTaskType,
} from '../doc-schemas/report-docs.js';
import { contentAppealAdminTaskDocId } from '../paths/compound-ids.js';
import { PATH_BUILDERS } from '../paths/path-builders.js';
import { toPath } from '../paths/utils.js';
import type { WorkProjectType } from '../types/content.js';

export interface TaskPriorityData {
  readonly [field: string]: unknown;
  readonly totalReports?: number;
  readonly lastReportReason?: string;
  readonly reason?: string;
  readonly fileType?: string;
  readonly hallWingType?: string;
  readonly category?: string;
  readonly priority?: string;
}

export type PrioritizedAdminTaskType = Extract<
  AdminTaskType,
  | 'userReport'
  | 'content-appeal'
  | 'thresholdLibraryReview'
  | 'hallContentChangeRequest'
  | 'adminDispatch'
>;

interface TaskPriorityRule {
  readonly base: TaskPriorityLevel;
  readonly boostConditions: {
    readonly critical?: (data: TaskPriorityData) => boolean;
    readonly high?: (data: TaskPriorityData) => boolean;
  };
}

export const TASK_PRIORITY_CONFIG: Readonly<Record<PrioritizedAdminTaskType, TaskPriorityRule>> = {
  userReport: {
    base: TASK_PRIORITY.HIGH,
    boostConditions: {
      critical: (data) =>
        (data.totalReports ?? 0) > 10 ||
        !!data.lastReportReason?.toLowerCase().includes('illegal') ||
        !!data.lastReportReason?.toLowerCase().includes('csam') ||
        !!data.lastReportReason?.toLowerCase().includes('child'),
    },
  },
  'content-appeal': {
    base: TASK_PRIORITY.NORMAL,
    boostConditions: {
      critical: (data) =>
        !!data.reason?.toLowerCase().includes('csam') ||
        !!data.reason?.toLowerCase().includes('child') ||
        !!data.reason?.toLowerCase().includes('illegal'),
      high: (data) => data.fileType === 'profile-picture',
    },
  },
  thresholdLibraryReview: {
    base: TASK_PRIORITY.NORMAL,
    boostConditions: {
      high: (data) => data.hallWingType === 'newsPolitical',
    },
  },
  hallContentChangeRequest: {
    base: TASK_PRIORITY.NORMAL,
    boostConditions: {},
  },
  adminDispatch: {
    base: TASK_PRIORITY.NORMAL,
    boostConditions: {
      high: (data) => data.category === 'urgent' || data.priority === 'urgent',
    },
  },
};

export function calculateTaskPriority(
  taskType: PrioritizedAdminTaskType,
  taskData: TaskPriorityData,
): TaskPriorityScore {
  const { base, boostConditions } = TASK_PRIORITY_CONFIG[taskType];
  if (boostConditions.critical?.(taskData))
    return TASK_PRIORITY_LEVEL_TO_SCORE[TASK_PRIORITY.CRITICAL];
  if (boostConditions.high?.(taskData)) return TASK_PRIORITY_LEVEL_TO_SCORE[TASK_PRIORITY.HIGH];
  return TASK_PRIORITY_LEVEL_TO_SCORE[base];
}

export interface ContentAppealTaskInput {
  readonly violationId: string;
  readonly userId: string;
  readonly fileType: string;
  readonly rejectionReason: string;
  readonly appealMessage: string;
  readonly rejectedFilePath: string;
  readonly now: number;
}

export function buildContentAppealTask(input: ContentAppealTaskInput): ContentAppealTask {
  const { violationId, fileType, rejectionReason, now } = input;
  const taskId = contentAppealAdminTaskDocId(violationId);
  return {
    id: taskId,
    taskType: 'content-appeal',
    taskId,
    violationId,
    userId: input.userId,
    fileType,
    rejectionReason,
    appealMessage: input.appealMessage,
    rejectedFilePath: input.rejectedFilePath,
    status: AdminTaskStatusSchema.enum.pending,
    checkoutDetails: null,
    originalPath: toPath(PATH_BUILDERS.contentViolation(violationId)),
    summary: `Appeal: ${fileType} — ${rejectionReason.substring(0, 80)}`,
    priority: calculateTaskPriority('content-appeal', { reason: rejectionReason, fileType }),
    createdAt: now,
    lastUpdatedAt: now,
  };
}

export interface ThresholdLibraryReviewTaskInput {
  readonly thresholdItem: Pick<
    ThresholdItem,
    'thresholdItemId' | 'workProjectId' | 'itemId' | 'hallWingType'
  >;
  readonly workProjectType: WorkProjectType;
  readonly foundingArtisanUid: string | null;
  readonly now: number;
}

export function buildThresholdLibraryReviewTask(
  input: ThresholdLibraryReviewTaskInput,
): AdminTaskDoc {
  const { thresholdItem, now } = input;
  return {
    taskType: 'thresholdLibraryReview',
    taskId: thresholdItem.thresholdItemId,
    foundingArtisanUid: input.foundingArtisanUid,
    originalPath: toPath(
      PATH_BUILDERS.thresholdItem(thresholdItem.workProjectId, thresholdItem.itemId),
    ),
    status: AdminTaskStatusSchema.enum.pending,
    checkoutDetails: null,
    summary: `Review ${input.workProjectType}`,
    priority: calculateTaskPriority('thresholdLibraryReview', thresholdItem),
    createdAt: now,
    lastUpdatedAt: now,
  };
}

export interface AdminDispatchTaskInput {
  readonly dispatch: Pick<
    AdminDispatch,
    'adminDispatchId' | 'subject' | 'partyKind' | 'workProjectId'
  >;
  readonly fromUid?: string;
  readonly now: number;
}

export function buildAdminDispatchTask(input: AdminDispatchTaskInput): AdminTaskDoc {
  const { dispatch, fromUid, now } = input;
  const { subject } = dispatch;
  const isWorkParty =
    dispatch.partyKind === 'workProject' && typeof dispatch.workProjectId === 'string';
  const base = isWorkParty ? `Work thread: ${subject}` : subject;
  return {
    taskType: 'adminDispatch',
    taskId: dispatch.adminDispatchId,
    originalPath: toPath(PATH_BUILDERS.adminDispatch(dispatch.adminDispatchId)),
    status: AdminTaskStatusSchema.enum.pending,
    checkoutDetails: null,
    summary: fromUid ? `${base} - from ${fromUid.substring(0, 8)}` : base,
    priority: calculateTaskPriority('adminDispatch', { subject, userId: fromUid }),
    createdAt: now,
    lastUpdatedAt: now,
    ...(isWorkParty
      ? { partyKind: 'workProject' as const, workProjectId: dispatch.workProjectId }
      : {}),
  };
}
