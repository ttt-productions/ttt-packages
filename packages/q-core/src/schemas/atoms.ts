import { z } from 'zod';
import { passwordIssueMessage } from '@ttt-productions/auth-core';
import { PASSWORD_POLICY } from '../constants/account-policy.js';
import { EMAIL_MAX_LENGTH } from '../constants/business.js';
import { CONTACT_PHONE_INPUT } from '../constants/phone-fields.js';
import {
  DISPLAY_NAME_INPUT,
  TEAM_INVITATION_MESSAGE_INPUT,
  TEAM_JOIN_REQUEST_MESSAGE_INPUT,
  TEAM_NAME_INPUT,
} from '../constants/text-fields.js';

import { documentIdSegmentSchema } from '../doc-schemas/atoms.js';
import { textFieldSchema } from './text-field.js';
import { phoneFieldSchema } from './phone-field.js';

export const actingEntrySchema = z.enum(['member', 'admin']);
export type ActingEntry = z.infer<typeof actingEntrySchema>;

export const teamInvitationIdSchema = documentIdSegmentSchema;
export const teamJoinRequestIdSchema = documentIdSegmentSchema;

export const displayNameSchema = textFieldSchema(DISPLAY_NAME_INPUT);
export const teamNameSchema = textFieldSchema(TEAM_NAME_INPUT);
export const teamJoinRequestMessageSchema = textFieldSchema(TEAM_JOIN_REQUEST_MESSAGE_INPUT);
export const teamInvitationMessageSchema = textFieldSchema(TEAM_INVITATION_MESSAGE_INPUT);
export const contactPhoneSchema = phoneFieldSchema(CONTACT_PHONE_INPUT);

export const accountEmailSchema = z
  .email({ message: 'Please enter a valid email.' })
  .max(EMAIL_MAX_LENGTH, { message: 'That email is too long.' });

export const accountPasswordSchema = z
  .string()
  .min(PASSWORD_POLICY.minLength, {
    message: passwordIssueMessage('tooShort', PASSWORD_POLICY),
  })
  .max(PASSWORD_POLICY.maxLength, {
    message: passwordIssueMessage('tooLong', PASSWORD_POLICY),
  });
