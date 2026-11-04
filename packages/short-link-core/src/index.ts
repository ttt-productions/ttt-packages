export {
  SHORT_LINK_ID_ALPHABET,
  SHORT_LINK_ID_LENGTH,
  SHORT_LINK_ID_MAX_ATTEMPTS,
  generateShortLinkId,
} from './short-link-id.js';
export type { RandomBytes } from './short-link-id.js';
export {
  createShortLinkSchema,
  isInAppDestination,
  shortLinkIdSchema,
} from './short-link-schema.js';
export type { ShortLinkDocument } from './short-link-schema.js';
