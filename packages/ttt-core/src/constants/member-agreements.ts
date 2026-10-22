// A wording change bumps its surface's version; the callable accepts only the current one.

import { SPECIAL_DOCS } from '../paths/collections.js';
import { PUBLIC_DOCUMENT_LABELS } from './public-documents.js';
import type { LegalReviewNoticeSegment } from './legal-review-notice.js';
import {
  EXISTING_REALM_STAKE_SHARES,
  MAX_WORK_PROJECT_STAKE_SHARES,
} from './business-work-project.js';

export type MemberAgreementWording = readonly LegalReviewNoticeSegment[];

function plain(text: string): MemberAgreementWording {
  return [{ kind: 'text', text }];
}

const RULES_AND_AGREEMENTS_LINK: LegalReviewNoticeSegment = {
  kind: 'link',
  label: PUBLIC_DOCUMENT_LABELS[SPECIAL_DOCS.RULES_AND_AGREEMENTS],
  target: SPECIAL_DOCS.RULES_AND_AGREEMENTS,
};

export const REGISTRATION_AGREEMENTS_VERSION = 1;

export const REGISTRATION_CONTENT_STANDARD_NOTICE =
  'At launch, TTT Productions keeps everything clean: no nudity, sexual, or explicit content. Profanity and mature themes are allowed. Down the road we aspire to support clearly labeled mature content — think R-rated film, never pornographic.';

export const REGISTRATION_CLEAN_CONTENT_AGREEMENT: MemberAgreementWording = plain(
  "I'll keep what I share clean: no nudity, sexual, or explicit content.",
);

export const ARTISAN_CREATOR_AGREEMENTS_VERSION = 2;

export const ARTISAN_CREATOR_DIALOG_TITLE = 'Become an Artisan';

export const ARTISAN_CREATOR_DIALOG_INTRO =
  'Unlock Artisan tools by agreeing to the terms below. This lets you share your crafts and create Works.';

export const ARTISAN_CREATOR_US_PERSON_QUESTION = 'Do you live in the United States?';

export const ARTISAN_CREATOR_AGREEMENT_IDS = [
  'realDateOfBirth',
  'humanMadeOnly',
  'uploadRights',
  'ownershipAndStewardship',
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
    ownershipAndStewardship: plain(
      "I understand what stays mine and what TTT holds. My Crafts, my Square posts, and any Audition Entry or Commission Proposal that isn't accepted stay mine — TTT only hosts and shows them here, and never sells, licenses, or gives them to anyone else. What I contribute to a Work is part of that Work, under the Work's invite agreement. A published Work, and anything selected in a TTT mascot Audition, is TTT-owned and held in stewardship: never sold, and no one — including me — makes money from it except through a TTT license and the split. My own live performances of my work stay mine.",
    ),
    rulesAndAgreements: [
      { kind: 'text', text: 'I have read and agree to the ' },
      RULES_AND_AGREEMENTS_LINK,
      { kind: 'text', text: '.' },
    ],
    collaborateOnline: plain(
      "I'll collaborate online only. I won't use TTT to arrange meeting another member in person. In-person TTT work will only ever happen at official TTT Productions locations, and none exist yet.",
    ),
  };

export const WORK_REALM_FOUNDING_AGREEMENT_VERSION = 2;

export const WORK_REALM_FOUNDING_AGREEMENT_TITLE = 'Realm Creation Agreement';

export const WORK_REALM_FOUNDING_AGREEMENT: MemberAgreementWording = plain(
  'By creating a new Realm, you agree that other Artisans may create and publish Works (Tales, ' +
    "Tunes, Television) set within your Realm. When they do, this Realm's founding Work receives " +
    `${EXISTING_REALM_STAKE_SHARES} of each such Work's ` +
    `${MAX_WORK_PROJECT_STAKE_SHARES.toLocaleString('en-US')} Stakes, held by the founding ` +
    "Work's Guild — not paid to you personally. Your Realm, like every Work, is held by TTT in " +
    'stewardship: never sold, and no one — including you — profits from it except through a TTT ' +
    'license and the split.',
);

export const SQUARE_STREETZ_AGREEMENTS_VERSION = 2;

export const SQUARE_STREETZ_MODERATION_NOTICE =
  'Before a post goes live, a banned-word list checks its text, and automated moderation scans any image or video. A post can be rejected automatically.';

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
    'I own what I post. I give TTT a royalty-free license to host and show it here, and I let members make labeled, credited mimics of it. TTT never sells, licenses, or gives my posts to anyone else, and never uses them in an ad or a product without asking me first.',
  ),
  onTopic: plain(
    'My posts will be about TTT: its Works, crafts, Auditions, Commissions, and Artisans.',
  ),
};

export const PLEDGE_ATTESTATION_VERSION = 1;

export const PLEDGE_ATTESTATION: MemberAgreementWording = plain(
  "I confirm I'm 18 or older, and I understand my name and pledge amount will be visible to other TTT members.",
);

export const HALL_DOWNLOAD_ACKNOWLEDGEMENT_VERSION = 2;

export const HALL_DOWNLOAD_ACKNOWLEDGEMENT_TITLE = 'Before you download';

export const HALL_DOWNLOAD_ACKNOWLEDGEMENT =
  "Hall downloads are for your personal, offline use only. Please don't redistribute, repost, or share downloaded files — TTT holds published Works in stewardship for the Artisans who made them and the whole community. Using a download to make money — in a video, a stream, a product, or anything else — needs a license from TTT.";

export const HALL_DOWNLOAD_ACKNOWLEDGEMENT_ACCEPT_LABEL = 'I understand — download';

export const AUDITION_ENTRY_AGREEMENT_VERSION = 1;

export const AUDITION_ENTRY_AGREEMENT: MemberAgreementWording = plain(
  "I understand that submitting an Entry transfers nothing. If a Work accepts my Entry, I join its Guild, and what I contribute is part of that Work under its invite agreement. In a TTT mascot Audition, only a selected Entry goes to TTT — held in stewardship, never sold, and I'm permanently credited as an originator. An Entry that isn't selected stays mine; TTT only shows it on this Audition and never sells, licenses, or uses it for anything else.",
);

export const COMMISSION_PROPOSAL_AGREEMENT_VERSION = 1;

export const COMMISSION_PROPOSAL_AGREEMENT: MemberAgreementWording = plain(
  "I understand that sending a Proposal transfers nothing — my message and any file I attach stay mine. If the Work accepts me, I join its Guild, and what I contribute is part of that Work under its invite agreement. If it doesn't, TTT never sells, licenses, or uses my Proposal for anything else.",
);

export const GUILD_INVITE_BINDING_NOTICE_TITLE = 'Binding Agreement Notice';

export const GUILD_INVITE_BINDING_NOTICE_PARAGRAPHS = [
  'This conversation serves as the binding agreement for this role on the Work. All messages, offers, and confirmations within this chat will constitute the official terms of the engagement, including but not limited to responsibilities, timelines, and share allocation.',
  'No agreement here can sell, license, or give away the Work or any part of it, or let anyone — including the Guild — make money from it outside TTT and the split. What you contribute is part of the Work, and the Work is held by TTT in stewardship.',
] as const;
