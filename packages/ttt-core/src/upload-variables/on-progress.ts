import { z } from 'zod';
import type { UploadState } from '@ttt-productions/media-schemas';

// Zod 4 has no embeddable `z.function()`, so this checks for a function and returns the original,
// never a wrapper.
export const onProgressSchema = z
  .custom<(state: UploadState | null) => void>((value) => typeof value === 'function')
  .optional();
