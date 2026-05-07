import { z } from 'zod';
import { violationIdSchema, taskIdSchema } from './atoms.js';
import type { AdminTaskType } from '../types/admin.js';

const ADMIN_TASK_TYPES: [AdminTaskType, ...AdminTaskType[]] = [
  'systemMessage',
  'libraryReview',
  'userReport',
  'content-appeal',
];

export const CheckoutNextImportantTaskInputSchema = z.object({}).strict();
export type CheckoutNextImportantTaskInput = z.infer<typeof CheckoutNextImportantTaskInputSchema>;

export const GetContentViolationInputSchema = z.object({
  violationId: violationIdSchema,
}).strict();
export type GetContentViolationInput = z.infer<typeof GetContentViolationInputSchema>;

export const MarkWorkLaterInputSchema = z.object({
  taskId: taskIdSchema,
  taskType: z.enum(ADMIN_TASK_TYPES),
  extendHours: z.union([z.literal(24), z.literal(48)]),
}).strict();
export type MarkWorkLaterInput = z.infer<typeof MarkWorkLaterInputSchema>;

export const ReviewContentAppealInputSchema = z.object({
  violationId: violationIdSchema,
  taskId: taskIdSchema,
  decision: z.enum(['approved', 'denied']),
  adminNotes: z.string().max(2000),
}).strict();
export type ReviewContentAppealInput = z.infer<typeof ReviewContentAppealInputSchema>;
