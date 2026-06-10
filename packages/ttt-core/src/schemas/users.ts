import { z } from 'zod';
import { userIdSchema } from './atoms.js';
import { USERNAME_MIN_LENGTH, USERNAME_MAX_LENGTH, USERNAME_REGEX } from '../constants/business.js';

export const AcceptSquareStreetzAgreementsInputSchema = z.object({}).strict();
export type AcceptSquareStreetzAgreementsInput = z.infer<typeof AcceptSquareStreetzAgreementsInputSchema>;

// The become-creator dialog's "I confirm I am 18 years of age or older" checkbox must reach the
// server: the callable rejects when absent and records the attestation on the
// artisanCreator.grantedToUser audit event (immutable, timestamped, with IP/UA) so it is provable.
export const BecomeArtisanCreatorInputSchema = z.object({
  ageAttested: z.literal(true),
}).strict();
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
  status: z.enum(['active', 'suspended', 'banned']),
  // Required by the callable when status is 'suspended' or 'banned' (shown to the
  // user in their restricted view and recorded on the audit event). Optional here
  // so reinstating to 'active' can omit it; the callable enforces presence.
  reason: z.string().trim().min(1).max(2000).optional(),
}).strict();
export type SetUserStatusInput = z.infer<typeof SetUserStatusInputSchema>;

// Admin forces an abusive display name off a user: the name is swapped to a neutral
// placeholder, the old name is blocked from reuse, and the user must pick a new one.
export const ForceDisplayNameResetInputSchema = z.object({
  userId: userIdSchema,
  // Optional admin note recorded on the audit event.
  reason: z.string().trim().min(1).max(2000).optional(),
}).strict();
export type ForceDisplayNameResetInput = z.infer<typeof ForceDisplayNameResetInputSchema>;

// User completes a forced display-name reset by choosing a new name. Only honored while
// the caller's userProfiles doc has `displayNameResetRequired === true`.
export const SetMyDisplayNameInputSchema = z.object({
  displayName: z
    .string()
    .min(USERNAME_MIN_LENGTH)
    .max(USERNAME_MAX_LENGTH)
    .regex(USERNAME_REGEX),
}).strict();
export type SetMyDisplayNameInput = z.infer<typeof SetMyDisplayNameInputSchema>;

