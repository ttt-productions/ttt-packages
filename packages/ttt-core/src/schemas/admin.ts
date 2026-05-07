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

// --- System-doc admin updates ---

const FuturePlanItemSchema = z.object({
  id: z.string().min(1).max(128),
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(4000),
  order: z.number().int().min(0),
  videoUrl: z.string().url().max(2048).optional(),
  mediaType: z.enum(['video', 'image', 'audio', 'other']).optional(),
}).strict();

export const UpdateFuturePlansInputSchema = z.object({
  plans: z.array(FuturePlanItemSchema).max(200),
}).strict();
export type UpdateFuturePlansInput = z.infer<typeof UpdateFuturePlansInputSchema>;

const RuleSchema = z.object({
  id: z.string().min(1).max(128),
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(4000),
  videoUrl: z.string().url().max(2048).optional(),
  group: z.enum(['generic', 'projectType', 'libraryType', 'universe', 'merchandising']).optional(),
  subgroup: z.enum(['Tales', 'Tunes', 'Television', 'entertainment', 'educational', 'newsPolitical']).optional(),
  order: z.number().int().min(0),
}).strict();

const AgreementCategorySchema = z.object({
  points: z.array(z.string().min(1).max(2000)).max(200),
  videoUrl: z.string().url().max(2048).optional(),
}).strict();

const AgreementsSchema = z.object({
  tales: AgreementCategorySchema.optional(),
  tunes: AgreementCategorySchema.optional(),
  television: AgreementCategorySchema.optional(),
}).strict();

// Partial update — admin UI may send only `rules` or only `agreements`.
// Server merges. At least one field must be present.
export const UpdateRulesAndAgreementsInputSchema = z.object({
  rules: z.array(RuleSchema).max(500).optional(),
  agreements: AgreementsSchema.optional(),
}).strict().refine(
  (data) => data.rules !== undefined || data.agreements !== undefined,
  { message: 'At least one of `rules` or `agreements` must be provided.' },
);
export type UpdateRulesAndAgreementsInput = z.infer<typeof UpdateRulesAndAgreementsInputSchema>;

const AppConfigDocIdSchema = z.literal('app');

export const UpdateAppConfigInputSchema = z.object({
  docId: AppConfigDocIdSchema,
  data: z.object({
    appVersion: z.string().min(1).max(64).optional(),
    maintenanceMode: z.boolean().optional(),
    maintenanceMessage: z.string().max(2000).optional(),
    registrationEnabled: z.boolean().optional(),
  }).strict().refine(
    (d) => Object.keys(d).length > 0,
    { message: 'data must have at least one field' },
  ),
}).strict();
export type UpdateAppConfigInput = z.infer<typeof UpdateAppConfigInputSchema>;
