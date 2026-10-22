// ============================================================================
// MEMBER AGREEMENTS — the ONE home for the wording of each agreement a member ticks
// (registration, becoming an Artisan, founding a public Realm, the first Square
// post, a pledge, the Hall download acknowledgment) and the version naming each
// surface's wording. Every surface renders these words verbatim. A wording change
// bumps its surface's version: the callable behind the surface accepts only the
// current version and records it with the acceptance, so a record always names the
// words the member agreed to.
//
// Elsewhere: the registration Terms box carries the founder-notice clause, so its
// segments live with the notice (./legal-review-notice.ts) — REGISTRATION's version
// here covers its wording too. The Hall publish attestations live in
// ./publish-attestations.ts, the craft statements in ./craft-skill-statements.ts.
// ============================================================================

import { SPECIAL_DOCS } from '../paths/collections.js';
import { PUBLIC_DOCUMENT_LABELS } from './public-documents.js';
import type { LegalReviewNoticeSegment } from './legal-review-notice.js';
import {
  EXISTING_REALM_STAKE_SHARES,
  MAX_WORK_PROJECT_STAKE_SHARES,
} from './business-work-project.js';

/** One agreement's wording: text runs, with a public document as a link run. */
export type MemberAgreementWording = readonly LegalReviewNoticeSegment[];

function plain(text: string): MemberAgreementWording {
  return [{ kind: 'text', text }];
}

const RULES_AND_AGREEMENTS_LINK: LegalReviewNoticeSegment = {
  kind: 'link',
  label: PUBLIC_DOCUMENT_LABELS[SPECIAL_DOCS.RULES_AND_AGREEMENTS],
  target: SPECIAL_DOCS.RULES_AND_AGREEMENTS,
};

// ── Registration ─────────────────────────────────────────────────────────────

/** Names the registration wording: the clean-content box and the Terms box. */
export const REGISTRATION_AGREEMENTS_VERSION = 1;

/** Shown above the registration boxes. A notice, not an agreement — nothing is ticked for it. */
export const REGISTRATION_CONTENT_STANDARD_NOTICE =
  'At launch, TTT Productions keeps everything clean: no nudity, sexual, or explicit content. Profanity and mature themes are allowed. Down the road we aspire to support clearly labeled mature content — think R-rated film, never pornographic.';

/** The content box. Profanity and mature themes are allowed; nudity and sexual content are not. */
export const REGISTRATION_CLEAN_CONTENT_AGREEMENT: MemberAgreementWording = plain(
  "I'll keep what I share clean: no nudity, sexual, or explicit content.",
);

// ── Become an Artisan ────────────────────────────────────────────────────────

/** Names the become-an-Artisan wording: the intro, the location question, and every box. */
export const ARTISAN_CREATOR_AGREEMENTS_VERSION = 1;

export const ARTISAN_CREATOR_DIALOG_TITLE = 'Become an Artisan';

export const ARTISAN_CREATOR_DIALOG_INTRO =
  'Unlock Artisan tools by agreeing to the terms below. This lets you share your crafts and create Works.';

/** The location question. Only Yes leads to the agreements; No leads to the regional interest list. */
export const ARTISAN_CREATOR_US_PERSON_QUESTION = 'Do you live in the United States?';

/** The become-an-Artisan boxes, in the order the dialog shows them. */
export const ARTISAN_CREATOR_AGREEMENT_IDS = [
  'realDateOfBirth',
  'humanMadeOnly',
  'uploadRights',
  'rulesAndAgreements',
  'collaborateOnline',
] as const;
export type ArtisanCreatorAgreementId = (typeof ARTISAN_CREATOR_AGREEMENT_IDS)[number];

export const ARTISAN_CREATOR_AGREEMENTS: Record<ArtisanCreatorAgreementId, MemberAgreementWording> =
  {
    realDateOfBirth: plain("This is my real date of birth, and I'm 18 or older."),
    humanMadeOnly: plain(
      'Everything I upload is human-made: no AI-generated, AI-modified, or AI-completed content.',
    ),
    uploadRights: plain("I'll only upload work I made or have the right to use."),
    rulesAndAgreements: [
      { kind: 'text', text: 'I have read and agree to the ' },
      RULES_AND_AGREEMENTS_LINK,
      { kind: 'text', text: '.' },
    ],
    collaborateOnline: plain(
      "I'll collaborate online only. I won't use TTT to arrange meeting another member in person. In-person TTT work will only ever happen at official TTT Productions locations, and none exist yet.",
    ),
  };

// ── Founding a public Realm ──────────────────────────────────────────────────

/** Names the Realm founding wording. */
export const WORK_REALM_FOUNDING_AGREEMENT_VERSION = 1;

export const WORK_REALM_FOUNDING_AGREEMENT_TITLE = 'Realm Creation Agreement';

export const WORK_REALM_FOUNDING_AGREEMENT: MemberAgreementWording = plain(
  'By creating a new Realm, you agree that other Artisans may create and publish Works (Tales, ' +
    "Tunes, Television) set within your Realm. When they do, this Realm's founding Work receives " +
    `${EXISTING_REALM_STAKE_SHARES} of each such Work's ` +
    `${MAX_WORK_PROJECT_STAKE_SHARES.toLocaleString('en-US')} Stakes, held by the founding ` +
    "Work's Guild — not paid to you personally.",
);

// ── First Square post ────────────────────────────────────────────────────────

/** Names the Square first-post wording: the moderation notice and every box. */
export const SQUARE_STREETZ_AGREEMENTS_VERSION = 1;

/** Shown above the boxes. A notice, not an agreement — nothing is ticked for it. */
export const SQUARE_STREETZ_MODERATION_NOTICE =
  'Before a post goes live, a banned-word list checks its text, and automated moderation scans any image or video. A post can be rejected automatically.';

/** The Square first-post boxes, in the order the form shows them. */
export const SQUARE_STREETZ_AGREEMENT_IDS = [
  'communityRules',
  'respect',
  'ownership',
  'onTopic',
] as const;
export type SquareStreetzAgreementId = (typeof SQUARE_STREETZ_AGREEMENT_IDS)[number];

export const SQUARE_STREETZ_AGREEMENTS: Record<SquareStreetzAgreementId, MemberAgreementWording> = {
  communityRules: [
    { kind: 'text', text: "I've read the community rules on the " },
    RULES_AND_AGREEMENTS_LINK,
    {
      kind: 'text',
      text: ' page, and I understand breaking them can get me suspended or banned.',
    },
  ],
  respect: plain(
    "I'll treat people with respect — no bullying, harassment, or doxxing — and I won't use posts to share personal contact details or set up in-person meetups.",
  ),
  ownership: plain(
    'I own what I post. I give TTT a royalty-free license to host and show it here, and I let members make labeled, credited mimics of it.',
  ),
  onTopic: plain(
    'My posts will be about TTT: its Works, crafts, Auditions, Commissions, and Artisans.',
  ),
};

// ── Pledge checkout ──────────────────────────────────────────────────────────

/** Names the pledge attestation wording. */
export const PLEDGE_ATTESTATION_VERSION = 1;

/** Pledges are readable by every registered member, so the disclosure says members, not the public. */
export const PLEDGE_ATTESTATION: MemberAgreementWording = plain(
  "I confirm I'm 18 or older, and I understand my name and pledge amount will be visible to other TTT members.",
);

// ── Hall download ────────────────────────────────────────────────────────────

/** Names the Hall download acknowledgment wording. */
export const HALL_DOWNLOAD_ACKNOWLEDGEMENT_VERSION = 1;

export const HALL_DOWNLOAD_ACKNOWLEDGEMENT_TITLE = 'Before you download';

export const HALL_DOWNLOAD_ACKNOWLEDGEMENT =
  "Hall downloads are for your personal, offline use only. Please don't redistribute, repost, or share downloaded files — TTT holds published Works in stewardship for the Artisans who made them and the whole community.";

export const HALL_DOWNLOAD_ACKNOWLEDGEMENT_ACCEPT_LABEL = 'I understand — download';
