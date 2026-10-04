import { describe, it, expect } from 'vitest';
import * as F from '../src/constants/text-fields';
import { CHAT_MESSAGE_TEXT_INPUT } from '@ttt-productions/chat-schemas';
import { CreateChapterInputSchema } from '../src/schemas/hall-library';
import {
  CreateWorkProjectInputSchema,
  InviteUserToGuildInputSchema,
  UpdatePublicWorkProjectDetailsInputSchema,
} from '../src/schemas/work-project-management';
import { displayNameSchema } from '../src/schemas/users';
import { SubmitFeedbackInputSchema } from '../src/schemas/utility';
import { CommissionPostingTargetInfoSchema, CommissionProposalTargetInfoSchema } from '../src/media/target-info';
import { ReopenSafetyCaseInputSchema } from '../src/schemas/admin';
import { SubmitReportInputSchema } from '../src/schemas/safety';
import {
  MAX_INTERNAL_REASON_LENGTH,
  MAX_REPORT_COMMENT_LENGTH,
  MAX_USER_FACING_REASON_LENGTH,
  MIN_SAFETY_RATIONALE_LENGTH,
  MAX_WORK_PROJECT_STAKE_SHARES,
} from '../src/constants/business';

const spec = (d: { format: string; min: number; max: number }) => ({ format: d.format, min: d.min, max: d.max });

// The approved field table: each field's format, min, and max.
describe('the field declarations', () => {
  it('titles of Works, Realms, chapters, tracks, episodes, commissions, and auditions are English letters, digits, and spaces', () => {
    for (const d of [
      F.WORK_TITLE_INPUT,
      F.REALM_NAME_INPUT,
      F.CHAPTER_TITLE_INPUT,
      F.TUNE_TRACK_TITLE_INPUT,
      F.TELEVISION_EPISODE_TITLE_INPUT,
      F.COMMISSION_TITLE_INPUT,
      F.AUDITION_TITLE_INPUT,
    ]) {
      expect(spec(d)).toEqual({ format: 'englishNormal', min: 1, max: 150 });
    }
  });

  it('names, subjects, and the broadcast title are single-line', () => {
    expect(spec(F.WORK_FILE_FOLDER_NAME_INPUT)).toEqual({ format: 'singleLine', min: 1, max: 100 });
    expect(spec(F.REALM_FILE_FOLDER_NAME_INPUT)).toEqual({ format: 'singleLine', min: 1, max: 100 });
    expect(spec(F.GUILD_CHAT_CHANNEL_NAME_INPUT)).toEqual({ format: 'singleLine', min: 1, max: 50 });
    expect(spec(F.ADMIN_DISPATCH_SUBJECT_INPUT)).toEqual({ format: 'singleLine', min: 1, max: 100 });
    expect(spec(F.BROADCAST_TITLE_INPUT)).toEqual({ format: 'singleLine', min: 1, max: 150 });
    expect(spec(F.THEME_NAME_INPUT)).toEqual({ format: 'singleLine', min: 1, max: 50 });
  });

  it('usernames and feedback suggestions keep their character sets', () => {
    expect(spec(F.USERNAME_INPUT)).toEqual({ format: 'englishNormalNoSpaces', min: 3, max: 20 });
    expect(spec(F.FEEDBACK_SUGGESTION_INPUT)).toEqual({ format: 'englishLettersOnly', min: 1, max: 100 });
  });

  it('the audition description is optional; the commission description and cover letter are required', () => {
    expect(F.AUDITION_DESCRIPTION_INPUT.min).toBe(0);
    expect(F.COMMISSION_DESCRIPTION_INPUT.min).toBe(1);
    expect(F.COMMISSION_COVER_LETTER_INPUT.min).toBe(1);
  });

  it('a report comment is required and capped at the report comment length', () => {
    expect(spec(F.REPORT_COMMENT_INPUT)).toEqual({ format: 'none', min: 1, max: MAX_REPORT_COMMENT_LENGTH });
  });

  it('safety internal reasons need the substantive-rationale minimum', () => {
    expect(F.SAFETY_INTERNAL_REASON_INPUT.min).toBe(MIN_SAFETY_RATIONALE_LENGTH);
    expect(F.TAKE_IT_DOWN_VALIDITY_RATIONALE_INPUT.min).toBe(MIN_SAFETY_RATIONALE_LENGTH);
  });

  it('hide reasons and the refund denial reason gain their caps', () => {
    expect(spec(F.HIDE_REASON_INPUT)).toEqual({ format: 'none', min: 1, max: MAX_INTERNAL_REASON_LENGTH });
    expect(spec(F.PLEDGE_REFUND_DENIAL_REASON_INPUT)).toEqual({ format: 'none', min: 1, max: MAX_USER_FACING_REASON_LENGTH });
  });

  it('an admin task check-in resolution is optional, up to the internal reason length', () => {
    expect(spec(F.ADMIN_TASK_RESOLUTION_INPUT)).toEqual({ format: 'none', min: 0, max: MAX_INTERNAL_REASON_LENGTH });
  });

  it('an admin-support thread message has the live chat message format and bounds', () => {
    expect(spec(F.SUPPORT_THREAD_MESSAGE_INPUT)).toEqual(spec(CHAT_MESSAGE_TEXT_INPUT));
  });

  it('every declaration names the field its refusals speak of', () => {
    for (const [name, value] of Object.entries(F)) {
      if (typeof value !== 'object' || value === null || !('format' in value)) continue;
      expect({ name, label: typeof (value as { label?: unknown }).label === 'string' && (value as { label: string }).label.length > 0 }).toEqual({ name, label: true });
    }
  });

  it('a change request always proposes text, even for a field authoring leaves optional', () => {
    expect(F.CHAPTER_CONTENT_INPUT.min).toBe(0);
    expect(F.HALL_CONTENT_CHANGE_REQUEST_INPUTS.chapter.content.min).toBe(1);
    expect(F.HALL_CONTENT_CHANGE_REQUEST_INPUTS.tale.title).toBe(F.WORK_TITLE_INPUT);
  });
});

describe('the wire schemas read the declarations', () => {
  it('a chapter title refuses apostrophes and accents, and is stored trimmed', () => {
    const base = { workProjectId: 'w', taleId: 't' };
    expect(CreateChapterInputSchema.safeParse({ ...base, title: "Dragon's Den" }).success).toBe(false);
    expect(CreateChapterInputSchema.safeParse({ ...base, title: 'Café' }).success).toBe(false);
    expect(CreateChapterInputSchema.parse({ ...base, title: '  Chapter One  ' }).title).toBe('Chapter One');
  });

  it('a Work is created and edited with its trimmed, non-blank title and description', () => {
    const create = {
      workingTitle: '  Night  ',
      workingDescription: '  A tale.  ',
      workProjectType: 'Tales',
      hallWingType: 'entertainment',
      realmCreationMode: 'newStandaloneRealm',
    };
    const parsed = CreateWorkProjectInputSchema.parse(create);
    expect([parsed.workingTitle, parsed.workingDescription]).toEqual(['Night', 'A tale.']);
    expect(CreateWorkProjectInputSchema.safeParse({ ...create, workingDescription: '   ' }).success).toBe(false);
  });

  it('a Work edit sends only what changed, but never nothing', () => {
    expect(UpdatePublicWorkProjectDetailsInputSchema.safeParse({ workProjectId: 'w', workingTitle: 'New' }).success).toBe(true);
    expect(UpdatePublicWorkProjectDetailsInputSchema.safeParse({ workProjectId: 'w' }).success).toBe(false);
  });

  it('a username is trimmed and keeps letters and digits only', () => {
    expect(displayNameSchema.parse(' abc123 ')).toBe('abc123');
    expect(displayNameSchema.safeParse('ab c').success).toBe(false);
  });

  it('a feedback suggestion is stored lowercase', () => {
    expect(SubmitFeedbackInputSchema.parse({ feedbackType: 'tradeProfessionSuggestions', suggestion: 'Banjo' }).suggestion).toBe('banjo');
  });

  it('commission text refuses blanks on the media path', () => {
    const posting = { title: 'Need a Score', description: '   ', requiredTradeProfessions: [], stakeSharesOffered: 10, workProjectId: 'w' };
    expect(CommissionPostingTargetInfoSchema.safeParse(posting).success).toBe(false);
    expect(CommissionProposalTargetInfoSchema.safeParse({ commissionListingId: 'c', replyText: ' ' }).success).toBe(false);
  });

  it('a guild invite offers whole shares within the Work total', () => {
    const invite = { workProjectId: 'w', inviteeUid: 'u', message: 'Join us', source: { type: 'craftSkill', data: { craftSkillId: 'c', craftSkillOwnerUserId: 'u', craftSkillName: 'Score' } } };
    expect(InviteUserToGuildInputSchema.safeParse({ ...invite, stakeSharesOffered: 0 }).success).toBe(false);
    expect(InviteUserToGuildInputSchema.safeParse({ ...invite, stakeSharesOffered: MAX_WORK_PROJECT_STAKE_SHARES + 1 }).success).toBe(false);
    expect(InviteUserToGuildInputSchema.safeParse({ ...invite, stakeSharesOffered: 5 }).success).toBe(true);
  });

  it('a safety reopen reason needs the substantive minimum', () => {
    const reopen = { caseType: 'childSafety', caseId: 'c1', confirmation: 'x' };
    const short = ReopenSafetyCaseInputSchema.safeParse({ ...reopen, reasonInternal: 'too short' });
    expect(short.success === false && short.error.issues.some((i) => i.path[0] === 'reasonInternal')).toBe(true);
  });

  it('a report requires a comment', () => {
    const report = { itemType: 'square-streetz-post', reportedItemId: 'p1', reason: 'Spam' };
    expect(SubmitReportInputSchema.safeParse(report).success).toBe(false);
    expect(SubmitReportInputSchema.safeParse({ ...report, comment: '   ' }).success).toBe(false);
    expect(SubmitReportInputSchema.safeParse({ ...report, comment: 'Spam link' }).success).toBe(true);
  });
});
