import { z } from 'zod';
import {
  CONTACT_PHONE_INPUT,
  DISPLAY_NAME_INPUT,
  TEAM_INVITATION_MESSAGE_INPUT,
  TEAM_JOIN_REQUEST_MESSAGE_INPUT,
  TEAM_NAME_INPUT,
} from '../constants/text-fields.js';

import { documentIdSegmentSchema } from '../doc-schemas/atoms.js';
import { textFieldSchema } from './text-field.js';

export const actingEntrySchema = z.enum(['member', 'admin']);
export type ActingEntry = z.infer<typeof actingEntrySchema>;

export const teamInvitationIdSchema = documentIdSegmentSchema;
export const teamJoinRequestIdSchema = documentIdSegmentSchema;

export const displayNameSchema = textFieldSchema(DISPLAY_NAME_INPUT);
export const teamNameSchema = textFieldSchema(TEAM_NAME_INPUT);
export const teamJoinRequestMessageSchema = textFieldSchema(TEAM_JOIN_REQUEST_MESSAGE_INPUT);
export const teamInvitationMessageSchema = textFieldSchema(TEAM_INVITATION_MESSAGE_INPUT);
export const contactPhoneSchema = textFieldSchema(CONTACT_PHONE_INPUT);
