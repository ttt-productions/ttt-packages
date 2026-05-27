import { z } from 'zod';
import { userIdSchema } from './atoms.js';
import { USERNAME_MIN_LENGTH, USERNAME_MAX_LENGTH, USERNAME_REGEX } from '../constants/business.js';

export const AcceptSquareStreetzAgreementsInputSchema = z.object({}).strict();
export type AcceptSquareStreetzAgreementsInput = z.infer<typeof AcceptSquareStreetzAgreementsInputSchema>;

export const BecomeArtisanCreatorInputSchema = z.object({}).strict();
export type BecomeArtisanCreatorInput = z.infer<typeof BecomeArtisanCreatorInputSchema>;

export const MarkWaitingForNewsApprovalInputSchema = z.object({}).strict();
export type MarkWaitingForNewsApprovalInput = z.infer<typeof MarkWaitingForNewsApprovalInputSchema>;

export const RegisterUserInputSchema = z.object({
  displayName: z
    .string()
    .min(USERNAME_MIN_LENGTH)
    .max(USERNAME_MAX_LENGTH)
    .regex(USERNAME_REGEX),
  agreements: z.object({
    age: z.literal(true),
    nudity: z.literal(true),
    meet: z.literal(true),
    cookies: z.literal(true),
    terms: z.literal(true),
  }).strict(),
}).strict();
export type RegisterUserInput = z.infer<typeof RegisterUserInputSchema>;

export const SetUserStatusInputSchema = z.object({
  userId: userIdSchema,
  status: z.enum(['active', 'disabled', 'banned']),
}).strict();
export type SetUserStatusInput = z.infer<typeof SetUserStatusInputSchema>;

