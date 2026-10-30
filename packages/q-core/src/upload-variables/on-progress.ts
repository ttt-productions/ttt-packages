import { z } from 'zod';
import type { UploadState } from '@ttt-productions/media-schemas';

// Zod 4 has no embeddable `z.function()` schema, so this validates "is a function" at parse time and
// returns the original callback, keeping its type and identity.
export const onProgressSchema = z
  .custom<(state: UploadState | null) => void>((value) => typeof value === 'function')
  .optional();
