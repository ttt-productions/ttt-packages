import { z } from 'zod';
import { userIdSchema, calendarDateSchema } from './atoms.js';
import { MAX_USER_SEARCH_QUERY_LENGTH } from '../constants/business-admin.js';
import { MAX_ARTISAN_LOCATION_LENGTH } from '../constants/business-user.js';
import {
  ACCOUNT_ACTION_REASON_INPUT,
  ARTISAN_LEGAL_NAME_INPUT,
  ARTISAN_REGION_INPUT,
  CLOSE_UNDER_13_REASON_INPUT,
  DISPLAY_NAME_RESET_REASON_INPUT,
  USERNAME_INPUT,
} from '../constants/text-fields.js';
import {
  ARTISAN_CREATOR_AGREEMENT_IDS,
  ARTISAN_CREATOR_AGREEMENTS_VERSION,
  HALL_DOWNLOAD_ACKNOWLEDGEMENT_VERSION,
  REGISTRATION_AGREEMENTS_VERSION,
  SQUARE_STREETZ_AGREEMENT_IDS,
  SQUARE_STREETZ_AGREEMENTS_VERSION,
} from '../constants/member-agreements.js';
import { textFieldSchema } from './text-field.js';
import type { PublicUserSearchResult } from '../types/admin-users.js';
import { UserAccountStatusSchema } from '../doc-schemas/user.js';
import { PublicDocumentVersionOrNoneSchema } from '../doc-schemas/public-documents.js';
import {
  ShownPublicDocumentVersionsSchema,
  PublicDocumentsRefreshRequiredResultSchema,
} from './public-documents.js';

export const displayNameSchema = textFieldSchema(USERNAME_INPUT);

export const DateOfBirthShapeSchema = z
  .object({
    year: z.number(),
    month: z.number(),
    day: z.number(),
  })
  .strict();

export const DateOfBirthSchema = DateOfBirthShapeSchema.extend({
  year: z.number().int(),
  month: z.number().int().min(1).max(12),
  day: z.number().int().min(1).max(31),
});
export type DateOfBirth = z.infer<typeof DateOfBirthSchema>;

function everyAgreementTicked<const Id extends string>(ids: readonly Id[]) {
  return z
    .object(
      Object.fromEntries(ids.map((id) => [id, z.literal(true)])) as Record<Id, z.ZodLiteral<true>>,
    )
    .strict();
}

export const AcceptSquareStreetzAgreementsInputSchema = z
  .object({
    agreements: everyAgreementTicked(SQUARE_STREETZ_AGREEMENT_IDS),
    agreementsVersion: z.literal(SQUARE_STREETZ_AGREEMENTS_VERSION),
  })
  .strict();
export type AcceptSquareStreetzAgreementsInput = z.infer<
  typeof AcceptSquareStreetzAgreementsInputSchema
>;

export const AcceptSquareStreetzAgreementsResultSchema = z.object({
  success: z.literal(true),
  alreadyAccepted: z.boolean(),
});
export type AcceptSquareStreetzAgreementsResult = z.infer<
  typeof AcceptSquareStreetzAgreementsResultSchema
>;

export const SquareStreetzAgreementsAcceptedAuditPayloadSchema = z
  .object({
    acceptedVersion: PublicDocumentVersionOrNoneSchema,
    previousAcceptedVersion: PublicDocumentVersionOrNoneSchema.nullable(),
    agreementsWordingVersion: z.number().int().positive(),
  })
  .strict();
export type SquareStreetzAgreementsAcceptedAuditPayload = z.infer<
  typeof SquareStreetzAgreementsAcceptedAuditPayloadSchema
>;

export const AcceptHallDownloadAcknowledgementInputSchema = z
  .object({
    acknowledgementVersion: z.literal(HALL_DOWNLOAD_ACKNOWLEDGEMENT_VERSION),
  })
  .strict();
export type AcceptHallDownloadAcknowledgementInput = z.infer<
  typeof AcceptHallDownloadAcknowledgementInputSchema
>;

export const AcceptHallDownloadAcknowledgementResultSchema = z.object({
  success: z.literal(true),
  alreadyAccepted: z.boolean(),
});
export type AcceptHallDownloadAcknowledgementResult = z.infer<
  typeof AcceptHallDownloadAcknowledgementResultSchema
>;

export const BecomeArtisanCreatorInputSchema = z
  .object({
    livesInUnitedStates: z.literal(true),
    dob: DateOfBirthSchema,
    fullLegalName: textFieldSchema(ARTISAN_LEGAL_NAME_INPUT),
    agreements: everyAgreementTicked(ARTISAN_CREATOR_AGREEMENT_IDS),
    agreementsVersion: z.literal(ARTISAN_CREATOR_AGREEMENTS_VERSION),
  })
  .strict();
export type BecomeArtisanCreatorInput = z.infer<typeof BecomeArtisanCreatorInputSchema>;

export const BecomeArtisanCreatorResultSchema = z.object({
  success: z.literal(true),
  alreadyArtisanCreator: z.boolean(),
});
export type BecomeArtisanCreatorResult = z.infer<typeof BecomeArtisanCreatorResultSchema>;

export const MarkWaitingForNewsApprovalInputSchema = z.object({}).strict();
export type MarkWaitingForNewsApprovalInput = z.infer<typeof MarkWaitingForNewsApprovalInputSchema>;

export const MarkWaitingForNewsApprovalResultSchema = z.object({
  success: z.literal(true),
  alreadyMarked: z.boolean(),
});
export type MarkWaitingForNewsApprovalResult = z.infer<
  typeof MarkWaitingForNewsApprovalResultSchema
>;

export const UpdateSiteTourPreferenceInputSchema = z.discriminatedUnion('action', [
  z
    .object({
      action: z.literal('deferToday'),
      date: calendarDateSchema,
    })
    .strict(),
  z
    .object({
      action: z.literal('dismissAutomaticInvites'),
    })
    .strict(),
  z
    .object({
      action: z.literal('completeTour'),
    })
    .strict(),
]);
export type UpdateSiteTourPreferenceInput = z.infer<typeof UpdateSiteTourPreferenceInputSchema>;

export const UpdateSiteTourPreferenceResultSchema = z.object({
  success: z.literal(true),
});
export type UpdateSiteTourPreferenceResult = z.infer<typeof UpdateSiteTourPreferenceResultSchema>;

export const SiteTourPendingPreferenceSchema = z.discriminatedUnion('action', [
  z
    .object({
      schemaVersion: z.literal(1),
      id: z.string().min(1),
      uid: userIdSchema,
      createdAt: z.number(),
      action: z.literal('deferToday'),
      date: calendarDateSchema,
    })
    .strict(),
  z
    .object({
      schemaVersion: z.literal(1),
      id: z.string().min(1),
      uid: userIdSchema,
      createdAt: z.number(),
      action: z.literal('dismissAutomaticInvites'),
    })
    .strict(),
  z
    .object({
      schemaVersion: z.literal(1),
      id: z.string().min(1),
      uid: userIdSchema,
      createdAt: z.number(),
      action: z.literal('completeTour'),
      tourVersion: z.number().int().positive(),
    })
    .strict(),
]);
export type SiteTourPendingPreference = z.infer<typeof SiteTourPendingPreferenceSchema>;

export const MarkNonUsArtisanInterestInputSchema = z
  .object({
    country: z.string().min(1).max(MAX_ARTISAN_LOCATION_LENGTH),
    region: textFieldSchema(ARTISAN_REGION_INPUT).optional(),
  })
  .strict();
export type MarkNonUsArtisanInterestInput = z.infer<typeof MarkNonUsArtisanInterestInputSchema>;

export const MarkNonUsArtisanInterestResultSchema = z.object({
  success: z.literal(true),
  alreadyMarked: z.boolean(),
});
export type MarkNonUsArtisanInterestResult = z.infer<typeof MarkNonUsArtisanInterestResultSchema>;

export const RegisterUserInputSchema = z
  .object({
    displayName: displayNameSchema,
    agreements: z
      .object({
        cleanContent: z.literal(true),
        terms: z.literal(true),
      })
      .strict(),
    agreementsVersion: z.literal(REGISTRATION_AGREEMENTS_VERSION),
    publicDocuments: ShownPublicDocumentVersionsSchema,
  })
  .strict();
export type RegisterUserInput = z.infer<typeof RegisterUserInputSchema>;

export const RegisterUserResultSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('registered') }),
  PublicDocumentsRefreshRequiredResultSchema,
  z.object({ status: z.literal('registrationExpired') }),
]);
export type RegisterUserResult = z.infer<typeof RegisterUserResultSchema>;

export const SetUserStatusInputSchema = z
  .object({
    userId: userIdSchema,
    status: UserAccountStatusSchema,
    reason: textFieldSchema(ACCOUNT_ACTION_REASON_INPUT).optional(),
  })
  .strict();
export type SetUserStatusInput = z.infer<typeof SetUserStatusInputSchema>;

export const SetUserStatusResultSchema = z.object({
  success: z.literal(true),
  message: z.string(),
  auditEventId: z.string().min(1).optional(),
});
export type SetUserStatusResult = z.infer<typeof SetUserStatusResultSchema>;

export const ForceDisplayNameResetInputSchema = z
  .object({
    userId: userIdSchema,
    reason: textFieldSchema(DISPLAY_NAME_RESET_REASON_INPUT).optional(),
  })
  .strict();
export type ForceDisplayNameResetInput = z.infer<typeof ForceDisplayNameResetInputSchema>;

export const ForceDisplayNameResetResultSchema = z.object({
  success: z.literal(true),
  auditEventId: z.string().min(1).optional(),
});
export type ForceDisplayNameResetResult = z.infer<typeof ForceDisplayNameResetResultSchema>;

export const CloseAccountUnder13InputSchema = z
  .object({
    userId: userIdSchema,
    reason: textFieldSchema(CLOSE_UNDER_13_REASON_INPUT),
  })
  .strict();
export type CloseAccountUnder13Input = z.infer<typeof CloseAccountUnder13InputSchema>;

export const CloseAccountUnder13OutcomeSchema = z.enum(['scrubbed', 'parked']);
export type CloseAccountUnder13Outcome = z.infer<typeof CloseAccountUnder13OutcomeSchema>;

export const CloseAccountUnder13ResultSchema = z.object({
  success: z.literal(true),
  outcome: CloseAccountUnder13OutcomeSchema,
});
export type CloseAccountUnder13Result = z.infer<typeof CloseAccountUnder13ResultSchema>;

export const SetMyDisplayNameInputSchema = z
  .object({
    displayName: displayNameSchema,
  })
  .strict();
export type SetMyDisplayNameInput = z.infer<typeof SetMyDisplayNameInputSchema>;

export const SetMyDisplayNameResultSchema = z.object({
  success: z.literal(true),
});
export type SetMyDisplayNameResult = z.infer<typeof SetMyDisplayNameResultSchema>;

export const CheckDisplayNameAvailableInputSchema = z
  .object({
    displayName: displayNameSchema,
  })
  .strict();
export type CheckDisplayNameAvailableInput = z.infer<typeof CheckDisplayNameAvailableInputSchema>;

export const DISPLAY_NAME_UNAVAILABLE_REASONS = ['taken', 'reserved', 'disallowed'] as const;
export const DisplayNameUnavailableReasonSchema = z.enum(DISPLAY_NAME_UNAVAILABLE_REASONS);
export type DisplayNameUnavailableReason = z.infer<typeof DisplayNameUnavailableReasonSchema>;

export const CheckDisplayNameAvailableResultSchema = z.object({
  available: z.boolean(),
  reason: DisplayNameUnavailableReasonSchema.optional(),
});
export type CheckDisplayNameAvailableResult = z.infer<typeof CheckDisplayNameAvailableResultSchema>;

export const UpgradeAccountToAdultInputSchema = z
  .object({
    dob: DateOfBirthSchema,
  })
  .strict();
export type UpgradeAccountToAdultInput = z.infer<typeof UpgradeAccountToAdultInputSchema>;

export const UpgradeAccountToAdultResultSchema = z.object({
  success: z.literal(true),
  alreadyAdult: z.boolean(),
});
export type UpgradeAccountToAdultResult = z.infer<typeof UpgradeAccountToAdultResultSchema>;

export const SearchPublicUsersInputSchema = z
  .object({
    query: z.string().trim().min(1).max(MAX_USER_SEARCH_QUERY_LENGTH),
  })
  .strict();
export type SearchPublicUsersInput = z.infer<typeof SearchPublicUsersInputSchema>;

export type SearchPublicUsersResult = { users: PublicUserSearchResult[] };

export const LookupUserByEmailOrUidInputSchema = z
  .object({
    query: z.string().trim().min(1).max(MAX_USER_SEARCH_QUERY_LENGTH),
  })
  .strict();
export type LookupUserByEmailOrUidInput = z.infer<typeof LookupUserByEmailOrUidInputSchema>;

export const USER_LOOKUP_EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const USER_LOOKUP_UID_PATTERN = /^[A-Za-z0-9]{28}$/;

export type UserSearchKind = 'email' | 'uid' | 'name';

export function detectUserSearchKind(query: string): UserSearchKind {
  const trimmed = query.trim();
  if (USER_LOOKUP_EMAIL_PATTERN.test(trimmed)) return 'email';
  if (USER_LOOKUP_UID_PATTERN.test(trimmed)) return 'uid';
  return 'name';
}

export const AdminUserLookupResultSchema = z.object({
  uid: z.string(),
  displayName: z.string(),
  email: z.string(),
  status: UserAccountStatusSchema,
  isAdmin: z.boolean().optional(),
});
export type AdminUserLookupResult = z.infer<typeof AdminUserLookupResultSchema>;

export const LookupUserByEmailOrUidResultSchema = z.object({
  user: AdminUserLookupResultSchema.nullable(),
});
export type LookupUserByEmailOrUidResult = z.infer<typeof LookupUserByEmailOrUidResultSchema>;

export const RequestAccountDeletionResultSchema = z.object({
  success: z.literal(true),
  scheduledScrubAt: z.number(),
  alreadyPending: z.boolean(),
});
export type RequestAccountDeletionResult = z.infer<typeof RequestAccountDeletionResultSchema>;

export const RequestAccountDeletionInputSchema = z.object({}).strict();
export type RequestAccountDeletionInput = z.infer<typeof RequestAccountDeletionInputSchema>;

export const CancelAccountDeletionInputSchema = z.object({}).strict();
export type CancelAccountDeletionInput = z.infer<typeof CancelAccountDeletionInputSchema>;

export const CancelAccountDeletionResultSchema = z.object({
  success: z.literal(true),
  cancelled: z.boolean(),
});
export type CancelAccountDeletionResult = z.infer<typeof CancelAccountDeletionResultSchema>;
