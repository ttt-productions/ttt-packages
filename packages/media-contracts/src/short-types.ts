import { z } from "zod";

export const ShortProjectSchema = z
  .object({
    projectId: z.string().min(1),
    type: z.string().min(1),
    workingDescription: z.string(),
    workingTitle: z.string(),
  })
  .strict();

export const ShortUserSchema = z
  .object({
    uid: z.string().min(1),
    displayName: z.string(),
    profilePictureUrlMedium: z.string().nullable().optional(),
  })
  .strict();

export type ShortProject = z.infer<typeof ShortProjectSchema>;
export type ShortUser = z.infer<typeof ShortUserSchema>;

// Keep these shapes in sync with ttt-core's ShortProject / ShortUser.
// Drift detection lives in ttt-core's tests.
