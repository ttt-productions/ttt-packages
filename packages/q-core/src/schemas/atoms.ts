// Atoms only callable wire contracts use. Enums, id atoms, the count, and the repair reason are the
// document atoms, declared once in doc-schemas/atoms.ts and imported from there.

import { z } from 'zod';
import {
  CONTACT_PHONE_INPUT_FORMAT,
  DISPLAY_NAME_INPUT_FORMAT,
  TEAM_INVITATION_MESSAGE_INPUT_FORMAT,
  TEAM_JOIN_REQUEST_MESSAGE_INPUT_FORMAT,
  TEAM_NAME_INPUT_FORMAT,
} from '../input-formats/input-formats.js';

import { documentIdSegmentSchema, textFieldSchema } from '../doc-schemas/atoms.js';

// Which entry of a member/admin twin pair of callables an action calls: the member entry, which
// re-reads the caller's team membership, or the admin entry, which re-reads the role roster.
export const actingEntrySchema = z.enum(['member', 'admin']);
export type ActingEntry = z.infer<typeof actingEntrySchema>;

export const teamInvitationIdSchema = documentIdSegmentSchema;
export const teamJoinRequestIdSchema = documentIdSegmentSchema;

// A display name and a team name, each built from its field's one declaration, so the form and the
// wire run the same check.
export const displayNameSchema = textFieldSchema(DISPLAY_NAME_INPUT_FORMAT);
export const teamNameSchema = textFieldSchema(TEAM_NAME_INPUT_FORMAT);
// A player's message with a join request, built from the field's one declaration, so the form and
// the wire run the same check.
export const teamJoinRequestMessageSchema = textFieldSchema(TEAM_JOIN_REQUEST_MESSAGE_INPUT_FORMAT);
// A captain's note on an invitation is optional — an empty note is stored as the empty string.
export const teamInvitationMessageSchema = textFieldSchema(TEAM_INVITATION_MESSAGE_INPUT_FORMAT);
// A team's contact phone, built from its field's one declaration.
export const contactPhoneSchema = textFieldSchema(CONTACT_PHONE_INPUT_FORMAT);
