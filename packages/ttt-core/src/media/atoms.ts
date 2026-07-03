import { z } from "zod";

export const MentionTypeSchema = z.enum(['user', 'workProject', 'workRealm', 'commission', 'audition']);

// The persisted + wire Mention shape carries ids ONLY — never display text. Display
// identity (names/titles) is resolved by id at render time (Display Identity Invariant).
// `.strict()` rejects any unknown key (including a client-sent `text`), so a mention name
// snapshot can never persist. Caps bound the two id-bearing fields against doc-bloat abuse.
export const MentionSchema = z
  .object({
    placeholder: z.string().min(1).max(32),
    type: MentionTypeSchema,
    id: z.string().min(1).max(128),
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


