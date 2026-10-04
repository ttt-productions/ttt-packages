import { describe, it, expect } from 'vitest';
import { checkTextField, textFieldRefusal } from '../src/utils/text-field';
import { textFieldSchema } from '../src/schemas/text-field';
import { validateHallContentTextFields } from '../src/utils/hall-content';
import {
  ADMIN_DISPATCH_SUBJECT_INPUT,
  FEEDBACK_SUGGESTION_INPUT,
  REALM_NAME_INPUT,
  SAFETY_INTERNAL_REASON_INPUT,
  USERNAME_INPUT,
  WORK_DESCRIPTION_INPUT,
  WORK_TITLE_INPUT,
} from '../src/constants/text-fields';
import { CheckRealmNameAvailableInputSchema } from '../src/schemas/work-project-management';

function schemaReason(schema: ReturnType<typeof textFieldSchema>, text: string): string | undefined {
  const parsed = schema.safeParse(text);
  return parsed.success ? undefined : parsed.error.issues[0]?.message;
}

// One wording family for every field: "<Field> cannot be empty." / "<Field> can be at most N
// characters." / the format's own character sentence.
describe('the refusal sentences', () => {
  it('an empty or whitespace-only text cannot be empty', () => {
    expect(checkTextField(WORK_TITLE_INPUT, '   ')).toEqual({ ok: false, reason: 'Title cannot be empty.' });
    expect(checkTextField(REALM_NAME_INPUT, '')).toEqual({ ok: false, reason: 'Realm name cannot be empty.' });
  });

  it('a long text names the field and its max', () => {
    expect(checkTextField(WORK_TITLE_INPUT, 'a'.repeat(151))).toEqual({ ok: false, reason: 'Title can be at most 150 characters.' });
  });

  it('each format words its characters', () => {
    expect(checkTextField(WORK_TITLE_INPUT, "Dragon's Den")).toEqual({
      ok: false,
      reason: 'Title can only use letters, numbers, and spaces.',
    });
    expect(checkTextField(USERNAME_INPUT, 'ab cd')).toEqual({ ok: false, reason: 'Username can only use letters and numbers.' });
    expect(checkTextField(FEEDBACK_SUGGESTION_INPUT, 'jazz2')).toEqual({ ok: false, reason: 'Suggestion can only use letters.' });
    expect(checkTextField(ADMIN_DISPATCH_SUBJECT_INPUT, 'two\nlines')).toEqual({ ok: false, reason: 'Subject must be on one line.' });
  });

  it('accepts and trims text the declaration allows', () => {
    expect(checkTextField(WORK_TITLE_INPUT, '  Night  ')).toEqual({ ok: true, value: 'Night' });
  });

  it('a field that allows every character is never refused for its characters', () => {
    expect(() => textFieldRefusal(WORK_DESCRIPTION_INPUT, 'invalidCharacters', 'x')).toThrow();
  });
});

describe('every boundary uses the one owner', () => {
  it('the zod schema refuses with the same sentence, never zod default text', () => {
    expect(schemaReason(textFieldSchema(WORK_TITLE_INPUT), "Dragon's Den")).toBe('Title can only use letters, numbers, and spaces.');
    expect(schemaReason(textFieldSchema(WORK_TITLE_INPUT), ' ')).toBe('Title cannot be empty.');
    expect(schemaReason(textFieldSchema(WORK_TITLE_INPUT), 'a'.repeat(151))).toBe('Title can be at most 150 characters.');
  });

  it('the Realm-name availability check shows the field sentence', () => {
    const parsed = CheckRealmNameAvailableInputSchema.safeParse({ workingTitle: 'Dragon.lands' });
    expect(parsed.success === false && parsed.error.issues[0]?.message).toBe('Realm name can only use letters, numbers, and spaces.');
  });

  it('the change-request checker shows the same sentence', () => {
    expect(validateHallContentTextFields('tale', { title: "Dragon's Den" })).toEqual({
      ok: false,
      reason: 'Title can only use letters, numbers, and spaces.',
    });
    expect(validateHallContentTextFields('tale', { description: '   ' })).toEqual({ ok: false, reason: 'Description cannot be empty.' });
  });
});

describe('a text shorter than a min above 1', () => {
  it('names the min', () => {
    expect(checkTextField(SAFETY_INTERNAL_REASON_INPUT, 'too short')).toEqual({
      ok: false,
      reason: 'Internal reason must be at least 10 characters.',
    });
    expect(checkTextField(USERNAME_INPUT, 'ab')).toEqual({ ok: false, reason: 'Username must be at least 3 characters.' });
  });
});
