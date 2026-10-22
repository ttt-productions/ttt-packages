import { z } from 'zod';
import { documentIdSegmentSchema } from '../schemas/atoms.js';
import { MAX_MENTIONS, MAX_MENTION_PLACEHOLDER_LENGTH } from '../constants/business-content.js';
import { SQUARE_POST_TEXT_INPUT } from '../constants/text-fields.js';
import { textFieldSchema } from '../schemas/text-field.js';

export const SquareStreetzPostTextSchema = textFieldSchema(SQUARE_POST_TEXT_INPUT);

export const MentionTypeSchema = z.enum([
  'user',
  'workProject',
  'workRealm',
  'commission',
  'audition',
]);

export const MentionSchema = z
  .object({
    placeholder: z.string().min(1).max(MAX_MENTION_PLACEHOLDER_LENGTH),
    type: MentionTypeSchema,
    id: documentIdSegmentSchema.max(128),
  })
  .strict();

export type MentionType = z.infer<typeof MentionTypeSchema>;
export type Mention = z.infer<typeof MentionSchema>;

export function rejectDuplicateMentionPlaceholders(
  mentions: readonly { placeholder: string }[],
  ctx: z.RefinementCtx,
): void {
  const seen = new Set<string>();
  for (let i = 0; i < mentions.length; i++) {
    const p = mentions[i].placeholder;
    if (seen.has(p)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Duplicate mention placeholder "${p}".`,
        path: [i, 'placeholder'],
      });
    }
    seen.add(p);
  }
}

// A run of `@m` and digits is one token, read whole, so `@m1` is never found inside `@m10`.

const MENTION_PLACEHOLDER_PATTERN = /^@m[1-9][0-9]*$/;
const MENTION_PLACEHOLDER_RUN = /@m[0-9]+/g;

export const MentionPlaceholderSchema = z
  .string()
  .max(MAX_MENTION_PLACEHOLDER_LENGTH)
  .regex(MENTION_PLACEHOLDER_PATTERN);

export function buildMentionPlaceholder(counter: number): string {
  if (!Number.isSafeInteger(counter) || counter < 1) {
    throw new RangeError('A mention placeholder counter is a positive whole number.');
  }
  return MentionPlaceholderSchema.parse(`@m${counter}`);
}

export type MentionContentSegment =
  { kind: 'text'; text: string } | { kind: 'mention'; placeholder: string };

export function tokenizeMentionContent(
  content: string,
  mentions: readonly { placeholder: string }[],
): MentionContentSegment[] {
  const listed = new Set(mentions.map((m) => m.placeholder));
  const segments: MentionContentSegment[] = [];
  let text = '';
  let from = 0;
  for (const match of content.matchAll(MENTION_PLACEHOLDER_RUN)) {
    const run = match[0];
    const at = match.index;
    text += content.slice(from, at);
    from = at + run.length;
    if (listed.has(run)) {
      if (text) segments.push({ kind: 'text', text });
      text = '';
      segments.push({ kind: 'mention', placeholder: run });
    } else {
      text += run;
    }
  }
  text += content.slice(from);
  if (text) segments.push({ kind: 'text', text });
  return segments;
}

export interface MentionCorrespondenceIssue {
  index: number;
  placeholder: string;
  occurrences: number;
}

export function validateMentionCorrespondence(
  content: string,
  mentions: readonly { placeholder: string }[],
): MentionCorrespondenceIssue[] {
  const counts = new Map<string, number>();
  for (const segment of tokenizeMentionContent(content, mentions)) {
    if (segment.kind === 'mention')
      counts.set(segment.placeholder, (counts.get(segment.placeholder) ?? 0) + 1);
  }
  const issues: MentionCorrespondenceIssue[] = [];
  mentions.forEach(({ placeholder }, index) => {
    const occurrences = counts.get(placeholder) ?? 0;
    if (occurrences !== 1) issues.push({ index, placeholder, occurrences });
  });
  return issues;
}

export function refineMentionCorrespondence(
  content: string,
  mentions: readonly { placeholder: string }[] | undefined,
  ctx: z.RefinementCtx,
  mentionsKey = 'mentions',
): void {
  if (!mentions) return;
  for (const issue of validateMentionCorrespondence(content, mentions)) {
    ctx.addIssue({
      code: 'custom',
      path: [mentionsKey, issue.index, 'placeholder'],
      params: { mentionCorrespondence: issue },
    });
  }
}

export const SquareStreetzPostMentionSchema = MentionSchema.extend({
  placeholder: MentionPlaceholderSchema,
}).strict();

export const SquareStreetzPostMentionsSchema = z
  .array(SquareStreetzPostMentionSchema)
  .max(MAX_MENTIONS)
  .superRefine(rejectDuplicateMentionPlaceholders);
