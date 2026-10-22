import type { WorkProjectType } from '../types/content.js';

// Bump when any attestation below changes.
export const PUBLISH_ATTESTATIONS_VERSION = 1;

export const CONSISTENT_FORMAT_WORDING: Record<WorkProjectType, string> = {
  Tales:
    'All items in this Work are the same kind of thing — a consistent format throughout. If chapter 1 is a short story, then all chapters are short stories.',
  Tunes:
    'All items in this Work are the same kind of thing — a consistent format throughout. If track 1 is a podcast, then all tracks are podcasts.',
  Television:
    'All items in this Work are the same kind of thing — a consistent format throughout. If episode 1 is a clip show, then all episodes are clip shows.',
};

export const PUBLISH_NO_CREDITS_ATTESTATION =
  "There are no credits or attribution baked into the content. Collaborators are credited on the Work's Guildmates section, which shows every guildmate on the Work — not inside the content itself.";

export const PUBLISH_NO_BEGGING_ATTESTATION =
  'The content does not ask viewers for bouquets or support — no begging for bouquets anywhere in the Work.';

export const PUBLISH_HUMAN_MADE_ORIGINAL_ATTESTATION =
  "This Work is entirely human-made and original: no AI-generated, AI-modified, or AI-completed content, and it is not built from anyone else's creative work.";

export const PUBLISH_STEWARDSHIP_ATTESTATION =
  "I understand that submitting locks this Work for editing, and once published it becomes TTT-owned, held in stewardship: it stays in the Hall, and its creators can't edit it directly — corrections go through an admin-reviewed change request.";
