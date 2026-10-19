// Callable contracts for user accounts and the global role rosters.

import { z } from 'zod';
import { MAX_ADMIN_LIST_CHANGES } from '../constants/business.js';
import {
  countSchema,
  repairReasonSchema,
  userIdSchema,
  userStatusSchema,
} from '../doc-schemas/atoms.js';
import { displayNameSchema } from './atoms.js';

// The signed-in caller finishes registration: profile, public identity, and the display-name
// reservation are created for `request.auth.uid`. Email comes from the token, never the payload.
export const RegisterUserInputSchema = z
  .object({
    displayName: displayNameSchema,
    // The terms checkbox, re-checked server-side: only `true` registers.
    acceptedTerms: z.literal(true),
  })
  .strict();
export type RegisterUserInput = z.infer<typeof RegisterUserInputSchema>;
export const RegisterUserResultSchema = z.discriminatedUnion('status', [
  // The account is registered (or already was — an idempotent replay).
  z
    .object({ status: z.literal('registered'), userId: userIdSchema, displayName: z.string() })
    .strict(),
  // The orphan-registration cleanup claimed this login for deletion, so the registration cannot
  // finish on it; nothing is written and the person signs up again.
  z.object({ status: z.literal('registrationExpired') }).strict(),
]);
export type RegisterUserResult = z.infer<typeof RegisterUserResultSchema>;

// The register form's check before the login is created: is the name free? It runs before any
// account exists, over the same name rule `registerUser` takes, and is a soft answer — the claim
// itself is `registerUser`'s transaction, which refuses `already-exists` when two registrations
// pass this check at once.
export const CheckDisplayNameAvailableInputSchema = z
  .object({ displayName: displayNameSchema })
  .strict();
export type CheckDisplayNameAvailableInput = z.infer<typeof CheckDisplayNameAvailableInputSchema>;
// Why a name is not available. Uniqueness is the only rule a Q-Sports name is held to beyond its
// input format.
export const DISPLAY_NAME_UNAVAILABLE_REASONS = ['taken'] as const;
export type DisplayNameUnavailableReason = (typeof DISPLAY_NAME_UNAVAILABLE_REASONS)[number];
export const CheckDisplayNameAvailableResultSchema = z
  .object({ available: z.boolean(), reason: z.enum(DISPLAY_NAME_UNAVAILABLE_REASONS).optional() })
  .strict();
export type CheckDisplayNameAvailableResult = z.infer<typeof CheckDisplayNameAvailableResultSchema>;

/** The longest text an admin's account search takes: a name, a full email address, or a uid. */
export const MAX_USER_SEARCH_QUERY_LENGTH = 100;

// Which read an admin's account search routes to: a full email address or a 28-character Firebase
// Auth uid is an exact lookup (`lookupUserByEmailOrUid`), anything else a name search. Declared once:
// the search box routes by it and the lookup callable re-derives the same answer, so a mis-routed
// request never looks an email up as a uid or the other way round.
export const USER_LOOKUP_EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const USER_LOOKUP_UID_PATTERN = /^[A-Za-z0-9]{28}$/;
export type UserSearchKind = 'email' | 'uid' | 'name';
export function detectUserSearchKind(query: string): UserSearchKind {
  const trimmed = query.trim();
  if (USER_LOOKUP_EMAIL_PATTERN.test(trimmed)) return 'email';
  if (USER_LOOKUP_UID_PATTERN.test(trimmed)) return 'uid';
  return 'name';
}

// An admin finds one account by its exact email address or its uid. The answer carries the
// owner-only email, so it is admin only.
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
    // Present, and true, only for an account on the admin roster.
    isAdmin: z.literal(true).optional(),
  })
  .strict();
export type LookedUpUser = z.infer<typeof LookedUpUserSchema>;
// The one exact match, or `null` when no account with a profile resolves.
export const LookupUserByEmailOrUidResultSchema = z
  .object({ user: LookedUpUserSchema.nullable() })
  .strict();
export type LookupUserByEmailOrUidResult = z.infer<typeof LookupUserByEmailOrUidResultSchema>;

// An admin searches accounts by the start of their name, over public display identity. Ghosts are
// not accounts and are left out; a banned account is found, with its status.
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

// An admin renames a user. Self-service rename is not a Q-Sports feature.
export const UpdateDisplayNameInputSchema = z
  .object({ userId: userIdSchema, newDisplayName: displayNameSchema })
  .strict();
export type UpdateDisplayNameInput = z.infer<typeof UpdateDisplayNameInputSchema>;
export const UpdateDisplayNameResultSchema = z
  .object({ userId: userIdSchema, displayName: z.string() })
  .strict();
export type UpdateDisplayNameResult = z.infer<typeof UpdateDisplayNameResultSchema>;

// An admin grants or revokes the two global roles on `_systemData/adminList`. Four named lists —
// never a role/action discriminator (BACKEND-002).
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

// An admin bans an account or lifts its ban. The reason is internal — recorded on the audit event,
// never shown to the account (BACKEND-212). Banning or unbanning to the status the account already
// holds changes nothing.
export const AdminUpdateUserStatusInputSchema = z
  .object({ userId: userIdSchema, userStatus: userStatusSchema, reason: repairReasonSchema })
  .strict();
export type AdminUpdateUserStatusInput = z.infer<typeof AdminUpdateUserStatusInputSchema>;

// `changed` is whether the status moved.
export const AdminUpdateUserStatusResultSchema = z
  .object({
    userId: userIdSchema,
    userStatus: userStatusSchema,
    previousStatus: userStatusSchema,
    changed: z.boolean(),
  })
  .strict();
export type AdminUpdateUserStatusResult = z.infer<typeof AdminUpdateUserStatusResultSchema>;

// The `details.reason` of the refusal to ban an account that holds admin standing (BACKEND-210), so
// a client can tell it from every other refusal.
export const ADMIN_STANDING_BAN_REFUSAL_REASON = 'adminStandingTarget';

// A signed-in login with no profile starts its registration, before `registerUser`: the record the
// orphan-login cleanup finds it by, and the owner-only private record `registerUser` requires. The
// caller is `request.auth.uid` and the email comes from its token, so it takes no input.
export const CreateRegistrationStartInputSchema = z.object({}).strict();
export type CreateRegistrationStartInput = z.infer<typeof CreateRegistrationStartInputSchema>;
// `started` wrote both records; `alreadyStarted` found the registration already started and wrote
// nothing — a retry, or a resume after a later step failed; `registrationExpired` found the login
// claimed by the orphan-registration cleanup and wrote nothing — the person signs up again.
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
