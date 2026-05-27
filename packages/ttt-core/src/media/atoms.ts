import { z } from "zod";

export const ShortProjectSchema = z
  .object({
    projectId: z.string().min(1),
    type: z.string().min(1),
    workingDescription: z.string(),
    workingTitle: z.string(),
  })
  .strict();

export type ShortProject = z.infer<typeof ShortProjectSchema>;

export const MentionTypeSchema = z.enum(['user', 'workProject', 'commission', 'audition']);

export const MentionSchema = z
  .object({
    placeholder: z.string().min(1),
    type: MentionTypeSchema,
    id: z.string().min(1),
    text: z.string(),
  })
  .strict();

export type MentionType = z.infer<typeof MentionTypeSchema>;
export type Mention = z.infer<typeof MentionSchema>;
