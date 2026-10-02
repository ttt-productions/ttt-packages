import { describe, it, expect } from 'vitest';
import {
  MentionPlaceholderSchema,
  buildMentionPlaceholder,
  tokenizeMentionContent,
  validateMentionCorrespondence,
  SquareStreetzPostMentionSchema,
  SquareStreetzPostMentionsSchema,
} from '../src/media';
import { CreateSquareStreetzTextPostInputSchema } from '../src/schemas/social';
import { SquareStreetzPostVariablesSchema } from '../src/upload-variables/square-streetz-post-variables';
import { MAX_MENTIONS } from '../src/constants/business';

const mention = (placeholder: string, id = 'u1') => ({ placeholder, type: 'user' as const, id });

describe('the mention placeholder grammar', () => {
  it('a placeholder is @m followed by a positive whole number', () => {
    for (const ok of ['@m1', '@m2', '@m10', '@m999']) {
      expect(MentionPlaceholderSchema.safeParse(ok).success, ok).toBe(true);
    }
    for (const bad of ['@m0', '@m01', '@m', '@mx', 'm1', '@M1', '@m1 ', ' @m1', '@m-1', '@m1.5', '@uid123']) {
      expect(MentionPlaceholderSchema.safeParse(bad).success, bad).toBe(false);
    }
  });

  it('a placeholder is at most 32 characters', () => {
    expect(MentionPlaceholderSchema.safeParse(`@m${'1'.repeat(30)}`).success).toBe(true);
    expect(MentionPlaceholderSchema.safeParse(`@m${'1'.repeat(31)}`).success).toBe(false);
  });

  it('the composer counter builds the placeholder', () => {
    expect(buildMentionPlaceholder(1)).toBe('@m1');
    expect(buildMentionPlaceholder(12)).toBe('@m12');
  });

  it('a counter that is not a positive whole number builds no placeholder', () => {
    for (const bad of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => buildMentionPlaceholder(bad), String(bad)).toThrow();
    }
  });
});

describe('tokenizing post text', () => {
  it('splits text and listed placeholders in order', () => {
    expect(tokenizeMentionContent('Hi @m1 and @m2!', [mention('@m1'), mention('@m2', 'u2')])).toEqual([
      { kind: 'text', text: 'Hi ' },
      { kind: 'mention', placeholder: '@m1' },
      { kind: 'text', text: ' and ' },
      { kind: 'mention', placeholder: '@m2' },
      { kind: 'text', text: '!' },
    ]);
  });

  it('@m1 never matches inside @m10', () => {
    expect(tokenizeMentionContent('see @m10', [mention('@m1')])).toEqual([{ kind: 'text', text: 'see @m10' }]);
    expect(tokenizeMentionContent('@m10 then @m1', [mention('@m1'), mention('@m10', 'u2')])).toEqual([
      { kind: 'mention', placeholder: '@m10' },
      { kind: 'text', text: ' then ' },
      { kind: 'mention', placeholder: '@m1' },
    ]);
  });

  it('an unlisted placeholder-shaped run stays text', () => {
    expect(tokenizeMentionContent('@m3 is not mentioned', [mention('@m1')])).toEqual([
      { kind: 'text', text: '@m3 is not mentioned' },
    ]);
  });

  it('a placeholder touching other text is still one token', () => {
    expect(tokenizeMentionContent('(@m1)', [mention('@m1')])).toEqual([
      { kind: 'text', text: '(' },
      { kind: 'mention', placeholder: '@m1' },
      { kind: 'text', text: ')' },
    ]);
  });

  it('text with no mentions is one text segment, and empty text is none', () => {
    expect(tokenizeMentionContent('plain', [])).toEqual([{ kind: 'text', text: 'plain' }]);
    expect(tokenizeMentionContent('', [])).toEqual([]);
  });
});

describe('placeholder and text correspondence', () => {
  it('each listed placeholder appearing exactly once is correspondent', () => {
    expect(validateMentionCorrespondence('Hi @m1 and @m2', [mention('@m1'), mention('@m2', 'u2')])).toEqual([]);
  });

  it('a listed placeholder missing from the text is an issue', () => {
    expect(validateMentionCorrespondence('Hi there', [mention('@m1')])).toEqual([
      { index: 0, placeholder: '@m1', occurrences: 0 },
    ]);
  });

  it('a listed placeholder appearing twice is an issue', () => {
    expect(validateMentionCorrespondence('@m1 @m1', [mention('@m1')])).toEqual([
      { index: 0, placeholder: '@m1', occurrences: 2 },
    ]);
  });

  it('@m10 in the text does not count as an occurrence of @m1', () => {
    expect(validateMentionCorrespondence('@m10', [mention('@m1')])).toEqual([
      { index: 0, placeholder: '@m1', occurrences: 0 },
    ]);
  });
});

describe('the post mention list', () => {
  it('takes only grammar placeholders', () => {
    expect(SquareStreetzPostMentionSchema.safeParse(mention('@m1')).success).toBe(true);
    expect(SquareStreetzPostMentionSchema.safeParse(mention('@user1')).success).toBe(false);
  });

  it('holds at most MAX_MENTIONS mentions with distinct placeholders', () => {
    const full = Array.from({ length: MAX_MENTIONS }, (_v, i) => mention(`@m${i + 1}`, `u${i}`));
    expect(SquareStreetzPostMentionsSchema.safeParse(full).success).toBe(true);
    expect(SquareStreetzPostMentionsSchema.safeParse([...full, mention(`@m${MAX_MENTIONS + 1}`)]).success).toBe(false);
    expect(SquareStreetzPostMentionsSchema.safeParse([mention('@m1'), mention('@m1', 'u2')]).success).toBe(false);
  });
});

describe('the text post and post variables refuse text that does not match its mentions', () => {
  it('a text post whose mentions each appear once is accepted', () => {
    expect(
      CreateSquareStreetzTextPostInputSchema.safeParse({ textContent: 'Hello @m1', mentions: [mention('@m1')] }).success,
    ).toBe(true);
    expect(CreateSquareStreetzTextPostInputSchema.safeParse({ textContent: 'Hello' }).success).toBe(true);
  });

  it('a text post naming a mention its text does not carry is refused at that mention', () => {
    const parsed = CreateSquareStreetzTextPostInputSchema.safeParse({ textContent: 'Hello', mentions: [mention('@m1')] });
    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues[0].path).toEqual(['mentions', 0, 'placeholder']);
  });

  it('a text post carrying one placeholder twice is refused', () => {
    expect(
      CreateSquareStreetzTextPostInputSchema.safeParse({ textContent: '@m1 @m1', mentions: [mention('@m1')] }).success,
    ).toBe(false);
  });

  it('a text post placeholder outside the grammar is refused', () => {
    expect(
      CreateSquareStreetzTextPostInputSchema.safeParse({ textContent: 'Hi @x', mentions: [mention('@x')] }).success,
    ).toBe(false);
  });

  it('post variables apply the same rule', () => {
    const base = { userId: 'u1' };
    expect(
      SquareStreetzPostVariablesSchema.safeParse({ ...base, content: 'Hey @m1', mentions: [mention('@m1')] }).success,
    ).toBe(true);
    expect(
      SquareStreetzPostVariablesSchema.safeParse({ ...base, content: 'Hey', mentions: [mention('@m1')] }).success,
    ).toBe(false);
  });
});
