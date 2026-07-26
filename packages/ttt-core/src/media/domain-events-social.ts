import { z } from "zod";

// DomainEvent schemas for the social domain — Square Streetz posts.
// Assembled into the discriminated union in ./domain-events.ts.

export const SquareStreetzPostCreatedEventSchema = z
  .object({
    type: z.literal('squareStreetz.postCreated'),
    ids: z
      .object({
        userId: z.string().min(1),
        postId: z.string().min(1),
      })
      .strict(),
  })
  .strict();

export const SquareStreetzPostLikedEventSchema = z
  .object({
    type: z.literal('squareStreetz.postLiked'),
    ids: z
      .object({
        userId: z.string().min(1),
        postId: z.string().min(1),
        authorId: z.string().min(1),
      })
      .strict(),
  })
  .strict();

export const SquareStreetzPostUnlikedEventSchema = z
  .object({
    type: z.literal('squareStreetz.postUnliked'),
    ids: z
      .object({
        userId: z.string().min(1),
        postId: z.string().min(1),
        authorId: z.string().min(1),
      })
      .strict(),
  })
  .strict();
