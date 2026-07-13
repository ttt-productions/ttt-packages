import { z } from 'zod';
import { userIdSchema } from './atoms.js';
import {
  USERNAME_MIN_LENGTH,
  USERNAME_MAX_LENGTH,
  USERNAME_REGEX,
  MAX_ARTISAN_LOCATION_LENGTH,
  MAX_INTERNAL_REASON_LENGTH,
} from '../constants/business.js';

export const AcceptSquareStreetzAgreementsInputSchema = z.object({}).strict();
export type AcceptSquareStreetzAgreementsInput = z.infer<typeof AcceptSquareStreetzAgreementsInputSchema>;

// One-time acknowledgement gate before a user may download Hall content for personal
// offline use (final wording owned by the legal-and-content step). No payload — the
// callable records the timestamp in the caller's privateData. See
// docs/design/media-assets-and-protected-serving.md (Hall/Library downloads).
export const AcceptHallDownloadAcknowledgementInputSchema = z.object({}).strict();
export type AcceptHallDownloadAcknowledgementInput = z.infer<typeof AcceptHallDownloadAcknowledgementInputSchema>;

// The become-creator dialog's "I confirm I am 18 years of age or older" checkbox must reach the
// server: the callable rejects when absent and records the attestation on the
// artisanCreator.grantedToUser audit event (immutable, timestamped, with IP/UA) so it is provable.
export const BecomeArtisanCreatorInputSchema = z.object({
  ageAttested: z.literal(true),
  // "I confirm I am a person located in the United States" — required for now (only U.S. persons
  // may become artisans). Mirrors ageAttested: the callable rejects when absent and records the
  // attestation timestamp (privateData.usPersonAttestedAt) + the grant audit event.
  usPersonAttested: z.literal(true),
  // [Q21.5 REVISED — DJ 2026-07-06] The artisan's date of birth — the ONLY point in the system
  // where a DOB is collected for persistence (registration/upgrade derive the bracket and store
  // nothing). The dialog copy tells the user this must be THEIR birthday: when the payout system
  // ships, it has to match their payout (KYC) identity. The callable re-derives 18+ server-side
  // from this value; an under-18 derivation rejects (failure audit, nothing stored). Stored as
  // privateData attestedDateOfBirth + attestedDobSource 'artisanOnboarding'.
  dob: z.object({
    year: z.number().int(),
    month: z.number().int().min(1).max(12),
    day: z.number().int().min(1).max(31),
  }).strict(),
}).strict();
export type BecomeArtisanCreatorInput = z.infer<typeof BecomeArtisanCreatorInputSchema>;

export const MarkWaitingForNewsApprovalInputSchema = z.object({}).strict();
export type MarkWaitingForNewsApprovalInput = z.infer<typeof MarkWaitingForNewsApprovalInputSchema>;

// Non-U.S. artisan-interest signup (the FCFS "waitlist" fields on privateData). Mirrors
// MarkWaitingForNewsApproval but carries the applicant's country (+ optional region) so signups
// can be opened by jurisdiction as each region's laws clear. The callable records it ONLY for
// adult accounts (never a minor's location).
export const MarkNonUsArtisanInterestInputSchema = z.object({
  country: z.string().min(1).max(MAX_ARTISAN_LOCATION_LENGTH),
  region: z.string().max(MAX_ARTISAN_LOCATION_LENGTH).optional(),
}).strict();
export type MarkNonUsArtisanInterestInput = z.infer<typeof MarkNonUsArtisanInterestInputSchema>;

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
  reason: z.string().trim().min(1).max(MAX_INTERNAL_REASON_LENGTH).optional(),
}).strict();
export type SetUserStatusInput = z.infer<typeof SetUserStatusInputSchema>;

// Admin forces an abusive display name off a user: the name is swapped to a neutral
// placeholder, the old name is blocked from reuse, and the user must pick a new one.
export const ForceDisplayNameResetInputSchema = z.object({
  userId: userIdSchema,
  // Optional admin note recorded on the audit event.
  reason: z.string().trim().min(1).max(MAX_INTERNAL_REASON_LENGTH).optional(),
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

// Unauthenticated soft-check the register page runs BEFORE creating the Auth user so a
// taken name never orphans an auth account. Mirrors the RegisterUser displayName contract
// (same length + regex). The authoritative claim still happens inside registerUser.
export const CheckDisplayNameAvailableInputSchema = z.object({
  displayName: z
    .string()
    .min(USERNAME_MIN_LENGTH)
    .max(USERNAME_MAX_LENGTH)
    .regex(USERNAME_REGEX),
}).strict();
export type CheckDisplayNameAvailableInput = z.infer<typeof CheckDisplayNameAvailableInputSchema>;

// Teen→adult upgrade: a transient DOB (never persisted) the callable re-derives adult
// eligibility from server-side against a fresh attestation. Only the shape is validated
// here; the age math + attestation binding live in the callable.
export const UpgradeAccountToAdultInputSchema = z.object({
  dob: z.object({
    year: z.number().int(),
    month: z.number().int().min(1).max(12),
    day: z.number().int().min(1).max(31),
  }).strict(),
}).strict();
export type UpgradeAccountToAdultInput = z.infer<typeof UpgradeAccountToAdultInputSchema>;

// Admin-only user lookup for the User Management view (prefix search on publicUsers by
// displayName). Only the trimmed query string is validated here; authz (admin/jr-admin)
// lives in the callable.
export const SearchPublicUsersInputSchema = z.object({
  query: z.string().trim().min(1).max(100),
}).strict();
export type SearchPublicUsersInput = z.infer<typeof SearchPublicUsersInputSchema>;

