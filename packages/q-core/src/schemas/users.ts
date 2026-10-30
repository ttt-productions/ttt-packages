import { z } from 'zod';
import { MAX_ADMIN_LIST_CHANGES } from '../constants/business.js';
import {
  countSchema,
  repairReasonSchema,
  userIdSchema,
  userStatusSchema,
} from '../doc-schemas/atoms.js';
import { displayNameSchema } from './atoms.js';

export const RegisterUserInputSchema = z
  .object({
    displayName: displayNameSchema,
    acceptedTerms: z.literal(true),
  })
  .strict();
export type RegisterUserInput = z.infer<typeof RegisterUserInputSchema>;
export const RegisterUserResultSchema = z.discriminatedUnion('status', [
  z
    .object({ status: z.literal('registered'), userId: userIdSchema, displayName: z.string() })
    .strict(),
  z.object({ status: z.literal('registrationExpired') }).strict(),
]);
export type RegisterUserResult = z.infer<typeof RegisterUserResultSchema>;

export const CheckDisplayNameAvailableInputSchema = z
  .object({ displayName: displayNameSchema })
  .strict();
export type CheckDisplayNameAvailableInput = z.infer<typeof CheckDisplayNameAvailableInputSchema>;
export const DISPLAY_NAME_UNAVAILABLE_REASONS = ['taken'] as const;
export type DisplayNameUnavailableReason = (typeof DISPLAY_NAME_UNAVAILABLE_REASONS)[number];
export const CheckDisplayNameAvailableResultSchema = z
  .object({ available: z.boolean(), reason: z.enum(DISPLAY_NAME_UNAVAILABLE_REASONS).optional() })
  .strict();
export type CheckDisplayNameAvailableResult = z.infer<typeof CheckDisplayNameAvailableResultSchema>;

export const MAX_USER_SEARCH_QUERY_LENGTH = 100;

export const USER_LOOKUP_EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const USER_LOOKUP_UID_PATTERN = /^[A-Za-z0-9]{28}$/;
export type UserSearchKind = 'email' | 'uid' | 'name';
export function detectUserSearchKind(query: string): UserSearchKind {
  const trimmed = query.trim();
  if (USER_LOOKUP_EMAIL_PATTERN.test(trimmed)) return 'email';
  if (USER_LOOKUP_UID_PATTERN.test(trimmed)) return 'uid';
  return 'name';
}

export const LookupUserByEmailOrUidInputSchema = z
  .object({ query: z.string().trim().min(1).max(MAX_USER_SEARCH_QUERY_LENGTH) })
  .strict();
export type LookupUserByEmailOrUidInput = z.infer<typeof LookupUserByEmailOrUidInputSchema>;
export const LookedUpUserSchema = z
  .object({
    uid: userIdSchema,
    displayName: z.string(),
    email: z.string(),
    userStatus: userStatusSchema,
    isAdmin: z.literal(true).optional(),
  })
  .strict();
export type LookedUpUser = z.infer<typeof LookedUpUserSchema>;
export const LookupUserByEmailOrUidResultSchema = z
  .object({ user: LookedUpUserSchema.nullable() })
  .strict();
export type LookupUserByEmailOrUidResult = z.infer<typeof LookupUserByEmailOrUidResultSchema>;

export const SearchPublicUsersInputSchema = z
  .object({ query: z.string().trim().min(1).max(MAX_USER_SEARCH_QUERY_LENGTH) })
  .strict();
export type SearchPublicUsersInput = z.infer<typeof SearchPublicUsersInputSchema>;
export const PublicUserSearchResultSchema = z
  .object({ uid: userIdSchema, displayName: z.string(), userStatus: userStatusSchema })
  .strict();
export type PublicUserSearchResult = z.infer<typeof PublicUserSearchResultSchema>;
export const SearchPublicUsersResultSchema = z
  .object({ users: z.array(PublicUserSearchResultSchema) })
  .strict();
export type SearchPublicUsersResult = z.infer<typeof SearchPublicUsersResultSchema>;

export const UpdateDisplayNameInputSchema = z
  .object({ userId: userIdSchema, newDisplayName: displayNameSchema })
  .strict();
export type UpdateDisplayNameInput = z.infer<typeof UpdateDisplayNameInputSchema>;
export const UpdateDisplayNameResultSchema = z
  .object({ userId: userIdSchema, displayName: z.string() })
  .strict();
export type UpdateDisplayNameResult = z.infer<typeof UpdateDisplayNameResultSchema>;

const adminListChangeSchema = z.array(userIdSchema).max(MAX_ADMIN_LIST_CHANGES).optional();
export const UpdateAdminListInputSchema = z
  .object({
    addAdmins: adminListChangeSchema,
    removeAdmins: adminListChangeSchema,
    addReferees: adminListChangeSchema,
    removeReferees: adminListChangeSchema,
  })
  .strict();
export type UpdateAdminListInput = z.infer<typeof UpdateAdminListInputSchema>;
export const UpdateAdminListResultSchema = z
  .object({
    adminsGranted: countSchema,
    adminsRevoked: countSchema,
    refereesGranted: countSchema,
    refereesRevoked: countSchema,
  })
  .strict();
export type UpdateAdminListResult = z.infer<typeof UpdateAdminListResultSchema>;

export const ADMIN_SELF_REVOKE_REFUSAL =
  "You can't revoke your own admin standing. Ask another admin to do it.";

export const AdminUpdateUserStatusInputSchema = z
  .object({ userId: userIdSchema, userStatus: userStatusSchema, reason: repairReasonSchema })
  .strict();
export type AdminUpdateUserStatusInput = z.infer<typeof AdminUpdateUserStatusInputSchema>;

export const AdminUpdateUserStatusResultSchema = z
  .object({
    userId: userIdSchema,
    userStatus: userStatusSchema,
    previousStatus: userStatusSchema,
    changed: z.boolean(),
  })
  .strict();
export type AdminUpdateUserStatusResult = z.infer<typeof AdminUpdateUserStatusResultSchema>;

export const ADMIN_STANDING_BAN_REFUSAL_REASON = 'adminStandingTarget';

export const CreateRegistrationStartInputSchema = z.object({}).strict();
export type CreateRegistrationStartInput = z.infer<typeof CreateRegistrationStartInputSchema>;
export const REGISTRATION_START_OUTCOMES = [
  'started',
  'alreadyStarted',
  'registrationExpired',
] as const;
export type RegistrationStartOutcome = (typeof REGISTRATION_START_OUTCOMES)[number];
export const CreateRegistrationStartResultSchema = z
  .object({ outcome: z.enum(REGISTRATION_START_OUTCOMES) })
  .strict();
export type CreateRegistrationStartResult = z.infer<typeof CreateRegistrationStartResultSchema>;
