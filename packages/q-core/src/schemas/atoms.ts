import { z } from 'zod';
import {
  CONTACT_PHONE_INPUT_FORMAT,
  DISPLAY_NAME_INPUT_FORMAT,
  TEAM_INVITATION_MESSAGE_INPUT_FORMAT,
  TEAM_JOIN_REQUEST_MESSAGE_INPUT_FORMAT,
  TEAM_NAME_INPUT_FORMAT,
} from '../input-formats/input-formats.js';

import { documentIdSegmentSchema, textFieldSchema } from '../doc-schemas/atoms.js';

export const actingEntrySchema = z.enum(['member', 'admin']);
export type ActingEntry = z.infer<typeof actingEntrySchema>;

export const teamInvitationIdSchema = documentIdSegmentSchema;
export const teamJoinRequestIdSchema = documentIdSegmentSchema;

export const displayNameSchema = textFieldSchema(DISPLAY_NAME_INPUT_FORMAT);
export const teamNameSchema = textFieldSchema(TEAM_NAME_INPUT_FORMAT);
export const teamJoinRequestMessageSchema = textFieldSchema(TEAM_JOIN_REQUEST_MESSAGE_INPUT_FORMAT);
export const teamInvitationMessageSchema = textFieldSchema(TEAM_INVITATION_MESSAGE_INPUT_FORMAT);
export const contactPhoneSchema = textFieldSchema(CONTACT_PHONE_INPUT_FORMAT);
