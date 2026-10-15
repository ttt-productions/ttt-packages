import { z } from 'zod';
import type { UploadState } from '@ttt-productions/media-schemas';

// Shared schema for the optional upload-progress callback carried in upload
// mutation variables. Zod 4 removed embeddable `z.function()` schemas, so this
// validates "is a function" at parse time and preserves the callback's type
// (and identity — zod 3's function schema returned a validating wrapper; this
// returns the original function).
export const onProgressSchema = z
  .custom<(state: UploadState | null) => void>((value) => typeof value === 'function')
  .optional();
