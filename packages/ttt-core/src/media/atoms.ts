import { z } from "zod";
import { documentIdSegmentSchema } from "../schemas/atoms.js";
import { MAX_MENTIONS, MAX_MENTION_PLACEHOLDER_LENGTH } from "../constants/business-content.js";
import { SQUARE_POST_TEXT_INPUT } from "../constants/text-fields.js";
import { textFieldSchema } from "../schemas/text-field.js";

/** A Square post's text — the ONE schema for a text post's text and a media post's caption. */
export const SquareStreetzPostTextSchema = textFieldSchema(SQUARE_POST_TEXT_INPUT);

export const MentionTypeSchema = z.enum(['user', 'workProject', 'workRealm', 'commission', 'audition']);

// The persisted + wire Mention shape carries ids ONLY — never display text. Display
// identity (names/titles) is resolved by id at render time (Display Identity Invariant).
// `.strict()` rejects any unknown key (including a client-sent `text`), so a mention name
// snapshot can never persist. Caps bound the two id-bearing fields against doc-bloat abuse.
export const MentionSchema = z
  .object({
    placeholder: z.string().min(1).max(MAX_MENTION_PLACEHOLDER_LENGTH),
    type: MentionTypeSchema,
    id: documentIdSegmentSchema.max(128),
  })
  .strict();

export type MentionType = z.infer<typeof MentionTypeSchema>;
export type Mention = z.infer<typeof MentionSchema>;

/**
 * Rejects duplicate `placeholder` values within a mentions array. Two mentions
 * sharing a placeholder collide at render time (the post card builds a
 * placeholder→mention map, last write wins), silently resolving BOTH tokens to
 * the later entity. Attached via `.superRefine` on every mentions-array schema.
 */
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

// --- Square post mentions: the placeholder grammar ---
// A post's text carries one placeholder token where each mention sits, and its `mentions` list
// says what each placeholder names. A placeholder is `@m` followed by a positive whole number
// (the composer's counter). In text, a run of `@m` and digits is ONE token, read whole — so `@m1`
// is never found inside `@m10` — and it is a mention only when the whole run is a listed
// placeholder; any other run is plain text.

const MENTION_PLACEHOLDER_PATTERN = /^@m[1-9][0-9]*$/;
const MENTION_PLACEHOLDER_RUN = /@m[0-9]+/g;

export const MentionPlaceholderSchema = z
  .string()
  .max(MAX_MENTION_PLACEHOLDER_LENGTH)
  .regex(MENTION_PLACEHOLDER_PATTERN);

/** The placeholder for the composer's `counter`-th mention. Throws for a counter that is not a positive whole number. */
export function buildMentionPlaceholder(counter: number): string {
  if (!Number.isSafeInteger(counter) || counter < 1) {
    throw new RangeError('A mention placeholder counter is a positive whole number.');
  }
  return MentionPlaceholderSchema.parse(`@m${counter}`);
}

export type MentionContentSegment =
  | { kind: 'text'; text: string }
  | { kind: 'mention'; placeholder: string };

/** Splits post text into text and mention segments, in order; adjacent text is one segment. */
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

/** A listed mention whose placeholder the text does not carry exactly once. */
export interface MentionCorrespondenceIssue {
  /** The mention's position in the list. */
  index: number;
  placeholder: string;
  /** How many times the text carries it as a whole token. */
  occurrences: number;
}

/** Every listed placeholder must appear in the text exactly once, as a whole token. */
export function validateMentionCorrespondence(
  content: string,
  mentions: readonly { placeholder: string }[],
): MentionCorrespondenceIssue[] {
  const counts = new Map<string, number>();
  for (const segment of tokenizeMentionContent(content, mentions)) {
    if (segment.kind === 'mention') counts.set(segment.placeholder, (counts.get(segment.placeholder) ?? 0) + 1);
  }
  const issues: MentionCorrespondenceIssue[] = [];
  mentions.forEach(({ placeholder }, index) => {
    const occurrences = counts.get(placeholder) ?? 0;
    if (occurrences !== 1) issues.push({ index, placeholder, occurrences });
  });
  return issues;
}

/**
 * The `superRefine` form of `validateMentionCorrespondence` for an object holding the text and the
 * list: one issue per failing mention, at `[mentionsKey, index, 'placeholder']`.
 */
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

/** One mention in a Square post: the shared Mention shape with a grammar placeholder. */
export const SquareStreetzPostMentionSchema = MentionSchema.extend({
  placeholder: MentionPlaceholderSchema,
}).strict();

/** A Square post's mention list — at most MAX_MENTIONS, each placeholder once. Every post input derives from it. */
export const SquareStreetzPostMentionsSchema = z
  .array(SquareStreetzPostMentionSchema)
  .max(MAX_MENTIONS)
  .superRefine(rejectDuplicateMentionPlaceholders);
