import { describe, it, expect } from 'vitest';
import {
  ARTISAN_CREATOR_AGREEMENT_IDS,
  ARTISAN_CREATOR_AGREEMENTS,
  ARTISAN_CREATOR_DIALOG_INTRO,
  ARTISAN_CREATOR_US_PERSON_QUESTION,
  PLEDGE_ATTESTATION,
  REGISTRATION_AGREEMENTS_VERSION,
  REGISTRATION_CLEAN_CONTENT_AGREEMENT,
  REGISTRATION_CONTENT_STANDARD_NOTICE,
  SQUARE_STREETZ_AGREEMENT_IDS,
  SQUARE_STREETZ_AGREEMENTS,
  SQUARE_STREETZ_AGREEMENTS_VERSION,
  SQUARE_STREETZ_MODERATION_NOTICE,
  WORK_REALM_FOUNDING_AGREEMENT,
  WORK_REALM_FOUNDING_AGREEMENT_VERSION,
  HALL_DOWNLOAD_ACKNOWLEDGEMENT,
  HALL_DOWNLOAD_ACKNOWLEDGEMENT_VERSION,
  AUDITION_ENTRY_AGREEMENT,
  AUDITION_ENTRY_AGREEMENT_VERSION,
  COMMISSION_PROPOSAL_AGREEMENT,
  COMMISSION_PROPOSAL_AGREEMENT_VERSION,
  GUILD_INVITE_BINDING_NOTICE_PARAGRAPHS,
  GUILD_INVITE_BINDING_NOTICE_TITLE,
} from '../src/constants/member-agreements.js';
import {
  PUBLISH_ATTESTATIONS_VERSION,
  PUBLISH_NO_CREDITS_ATTESTATION,
  PUBLISH_STEWARDSHIP_ATTESTATION,
} from '../src/constants/publish-attestations.js';
import { CreateCommissionProposalTextInputSchema } from '../src/schemas/commissions.js';
import {
  CRAFT_SKILL_STATEMENT_VERSION,
  CRAFT_SKILL_STATEMENTS,
} from '../src/constants/craft-skill-statements.js';
import { legalReviewNoticeSegmentsText } from '../src/constants/legal-review-notice.js';
import {
  EXISTING_REALM_STAKE_SHARES,
  MAX_WORK_PROJECT_STAKE_SHARES,
} from '../src/constants/business-work-project.js';
import { SPECIAL_DOCS } from '../src/paths/collections.js';
import {
  AcceptHallDownloadAcknowledgementInputSchema,
  AcceptSquareStreetzAgreementsInputSchema,
  RegisterUserInputSchema,
} from '../src/schemas/users.js';
import { CreateWorkProjectInputSchema } from '../src/schemas/work-project-management.js';
import { SubmitForThresholdLibraryReviewInputSchema } from '../src/schemas/hall-library.js';
import { UserAgreementsSchema } from '../src/doc-schemas/user.js';

const text = legalReviewNoticeSegmentsText;

describe('member agreement wording — each box reads exactly as ruled', () => {
  it('registration keeps what members share clean, allowing profanity and mature themes', () => {
    expect(text(REGISTRATION_CLEAN_CONTENT_AGREEMENT)).toBe(
      "I'll keep what I share clean: no nudity, sexual, or explicit content.",
    );
  });

  it('the notice above the registration boxes states the same standard, never a stricter one', () => {
    expect(REGISTRATION_CONTENT_STANDARD_NOTICE).toBe(
      'At launch, TTT Productions keeps everything clean: no nudity, sexual, or explicit content. Profanity and mature themes are allowed. Down the road we aspire to support clearly labeled mature content — think R-rated film, never pornographic.',
    );
    expect(REGISTRATION_CONTENT_STANDARD_NOTICE).not.toMatch(/every audience|for everyone/);
  });

  it('become an Artisan: one location question, the merged 18+ box, AI, rights, ownership, Rules, and online-only', () => {
    expect(ARTISAN_CREATOR_US_PERSON_QUESTION).toBe('Do you live in the United States?');
    expect(ARTISAN_CREATOR_DIALOG_INTRO).toContain('share your crafts and create Works');
    expect(ARTISAN_CREATOR_DIALOG_INTRO).not.toMatch(/skills|projects/);
    expect(
      Object.fromEntries(
        ARTISAN_CREATOR_AGREEMENT_IDS.map((id) => [id, text(ARTISAN_CREATOR_AGREEMENTS[id])]),
      ),
    ).toEqual({
      realDateOfBirth: "This is my real date of birth, and I'm 18 or older.",
      humanMadeOnly:
        'Everything I upload is human-made: no AI-generated, AI-modified, or AI-completed content.',
      uploadRights: "I'll only upload work I made or have the right to use.",
      ownershipAndStewardship:
        "I understand what stays mine and what TTT holds. My Crafts, my Square posts, and any Audition Entry or Commission Proposal that isn't accepted stay mine — TTT only hosts and shows them here, and never sells, licenses, or gives them to anyone else. What I contribute to a Work is part of that Work, under the Work's invite agreement. A published Work, and anything selected in a TTT mascot Audition, is TTT-owned and held in stewardship: never sold, and no one — including me — makes money from it except through a TTT license and the split. My own live performances of my work stay mine.",
      rulesAndAgreements: 'I have read and agree to the Rules & Agreements.',
      collaborateOnline:
        "I'll collaborate online only. I won't use TTT to arrange meeting another member in person. In-person TTT work will only ever happen at official TTT Productions locations, and none exist yet.",
    });
  });

  it('the ownership box comes right after the upload-rights box', () => {
    const order = [...ARTISAN_CREATOR_AGREEMENT_IDS];
    expect(order.indexOf('ownershipAndStewardship')).toBe(order.indexOf('uploadRights') + 1);
  });

  it('the online-only box comes right after the Rules & Agreements box, which links that page', () => {
    const order = [...ARTISAN_CREATOR_AGREEMENT_IDS];
    expect(order.indexOf('collaborateOnline')).toBe(order.indexOf('rulesAndAgreements') + 1);
    expect(ARTISAN_CREATOR_AGREEMENTS.rulesAndAgreements).toContainEqual(
      expect.objectContaining({ kind: 'link', target: SPECIAL_DOCS.RULES_AND_AGREEMENTS }),
    );
  });

  it('the Realm agreement states the founding stake from the stake constants', () => {
    expect(text(WORK_REALM_FOUNDING_AGREEMENT)).toBe(
      'By creating a new Realm, you agree that other Artisans may create and publish Works (Tales, ' +
        "Tunes, Television) set within your Realm. When they do, this Realm's founding Work " +
        `receives ${EXISTING_REALM_STAKE_SHARES} of each such Work's ` +
        `${MAX_WORK_PROJECT_STAKE_SHARES.toLocaleString('en-US')} Stakes, held by the founding ` +
        "Work's Guild — not paid to you personally. Your Realm, like every Work, is held by TTT " +
        'in stewardship: never sold, and no one — including you — profits from it except through ' +
        'a TTT license and the split.',
    );
    expect(text(WORK_REALM_FOUNDING_AGREEMENT)).toContain('75 of each such Work');
    expect(text(WORK_REALM_FOUNDING_AGREEMENT)).toContain('1,000 Stakes');
  });

  it('the Square first post: a moderation notice and four boxes', () => {
    expect(SQUARE_STREETZ_MODERATION_NOTICE).toBe(
      'Before a post goes live, a banned-word list checks its text, and automated moderation scans any image or video. A post can be rejected automatically.',
    );
    expect(
      Object.fromEntries(
        SQUARE_STREETZ_AGREEMENT_IDS.map((id) => [id, text(SQUARE_STREETZ_AGREEMENTS[id])]),
      ),
    ).toEqual({
      communityRules:
        "I've read the community rules on the Rules & Agreements page, and I understand breaking them can get me suspended or banned.",
      respect:
        "I'll treat people with respect — no bullying, harassment, or doxxing — and I won't use posts to share personal contact details or set up in-person meetups.",
      ownership:
        'I own what I post. I give TTT a royalty-free license to host and show it here, and I let members make labeled, credited mimics of it. TTT never sells, licenses, or gives my posts to anyone else, and never uses them in an ad or a product without asking me first.',
      onTopic:
        'My posts will be about TTT: its Works, crafts, Auditions, Commissions, and Artisans.',
    });
  });

  it('the Hall publish credits attestation names the Guildmates section', () => {
    expect(PUBLISH_NO_CREDITS_ATTESTATION).toContain("the Work's Guildmates section");
    expect(PUBLISH_NO_CREDITS_ATTESTATION).not.toContain('Guildmate Users');
  });

  it('the pledge attestation says members, not the public, see the name and amount', () => {
    expect(text(PLEDGE_ATTESTATION)).toBe(
      "I confirm I'm 18 or older, and I understand my name and pledge amount will be visible to other TTT members.",
    );
  });

  it('the Hall publish stewardship attestation says the Work is never sold and earns only through a TTT license', () => {
    expect(PUBLISH_STEWARDSHIP_ATTESTATION).toBe(
      "I understand that submitting locks this Work for editing, and once published it becomes TTT-owned, held in stewardship: it stays in the Hall, it is never sold, and no one — including me — can make money from it except through a TTT license and the split. Its creators can't edit it directly; corrections go through an admin-reviewed change request.",
    );
  });

  it('the Hall download notice says making money from a download needs a TTT license', () => {
    expect(HALL_DOWNLOAD_ACKNOWLEDGEMENT).toBe(
      "Hall downloads are for your personal, offline use only. Please don't redistribute, repost, or share downloaded files — TTT holds published Works in stewardship for the Artisans who made them and the whole community. Using a download to make money — in a video, a stream, a product, or anything else — needs a license from TTT.",
    );
  });

  it('the Audition entry agreement: nothing transfers, only a selected mascot Entry goes to TTT', () => {
    expect(text(AUDITION_ENTRY_AGREEMENT)).toBe(
      "I understand that submitting an Entry transfers nothing. If a Work accepts my Entry, I join its Guild, and what I contribute is part of that Work under its invite agreement. In a TTT mascot Audition, only a selected Entry goes to TTT — held in stewardship, never sold, and I'm permanently credited as an originator. An Entry that isn't selected stays mine; TTT only shows it on this Audition and never sells, licenses, or uses it for anything else.",
    );
  });

  it('the Commission proposal agreement: nothing transfers, and an unaccepted Proposal is never used', () => {
    expect(text(COMMISSION_PROPOSAL_AGREEMENT)).toBe(
      "I understand that sending a Proposal transfers nothing — my message and any file I attach stay mine. If the Work accepts me, I join its Guild, and what I contribute is part of that Work under its invite agreement. If it doesn't, TTT never sells, licenses, or uses my Proposal for anything else.",
    );
  });

  it('the Guild invite notice says no agreement there can sell or license the Work outside TTT', () => {
    expect(GUILD_INVITE_BINDING_NOTICE_TITLE).toBe('Binding Agreement Notice');
    expect(GUILD_INVITE_BINDING_NOTICE_PARAGRAPHS).toEqual([
      'This conversation serves as the binding agreement for this role on the Work. All messages, offers, and confirmations within this chat will constitute the official terms of the engagement, including but not limited to responsibilities, timelines, and share allocation.',
      'No agreement here can sell, license, or give away the Work or any part of it, or let anyone — including the Guild — make money from it outside TTT and the split. What you contribute is part of the Work, and the Work is held by TTT in stewardship.',
    ]);
  });

  it('craft statements promise TTT never sells your own craft, and a TTT mimic earns nothing outside TTT', () => {
    expect(CRAFT_SKILL_STATEMENTS.original).toBe(
      'I certify this craft is entirely my own original creation and I own all rights to it. No part of it copies or imitates another person’s work. It stays mine: TTT only hosts and shows it here, and never sells, licenses, or gives it to anyone else.',
    );
    expect(CRAFT_SKILL_STATEMENTS.mimicOnTtt).toBe(
      'This craft is my performance or recreation of work created by a member of the TTT Productions community, shown here to demonstrate my abilities. I have linked the original artisan or work below. The original belongs to its creator — or, if it’s a published Work, is held by TTT in stewardship — and I claim no ownership of it. I won’t make money from this mimic outside TTT.',
    );
  });

  it('craft statements say "craft", under a new statement version', () => {
    expect(CRAFT_SKILL_STATEMENT_VERSION).toBe(3);
    for (const statement of Object.values(CRAFT_SKILL_STATEMENTS)) {
      expect(statement).not.toMatch(/craft skill/i);
      expect(statement).toMatch(/\bcraft\b/);
    }
  });
});

describe('every agreement reaches the server with the wording version it was shown', () => {
  it('registration takes the clean-content and Terms boxes only, under the current version', () => {
    const base = {
      displayName: 'NewMember',
      agreements: { cleanContent: true, terms: true },
      agreementsVersion: REGISTRATION_AGREEMENTS_VERSION,
      publicDocuments: [],
    };
    expect(RegisterUserInputSchema.safeParse(base).success).toBe(true);
    for (const dropped of ['age', 'meet', 'cookies', 'nudity']) {
      expect(
        RegisterUserInputSchema.safeParse({
          ...base,
          agreements: { ...base.agreements, [dropped]: true },
        }).success,
        dropped,
      ).toBe(false);
    }
    expect(
      RegisterUserInputSchema.safeParse({ ...base, agreements: { terms: true } }).success,
    ).toBe(false);
    expect(
      RegisterUserInputSchema.safeParse({
        ...base,
        agreementsVersion: REGISTRATION_AGREEMENTS_VERSION + 1,
      }).success,
    ).toBe(false);
  });

  it('the stored registration record holds the ticked boxes and the wording version', () => {
    expect(
      UserAgreementsSchema.parse({
        cleanContent: true,
        terms: true,
        agreedOn: 1,
        wordingVersion: 1,
      }),
    ).toEqual({ cleanContent: true, terms: true, agreedOn: 1, wordingVersion: 1 });
  });

  it('the Square agreements arrive with every box ticked and the current version', () => {
    const agreements = Object.fromEntries(SQUARE_STREETZ_AGREEMENT_IDS.map((id) => [id, true]));
    const valid = { agreements, agreementsVersion: SQUARE_STREETZ_AGREEMENTS_VERSION };
    expect(AcceptSquareStreetzAgreementsInputSchema.safeParse(valid).success).toBe(true);
    expect(AcceptSquareStreetzAgreementsInputSchema.safeParse({}).success).toBe(false);
    for (const id of SQUARE_STREETZ_AGREEMENT_IDS) {
      expect(
        AcceptSquareStreetzAgreementsInputSchema.safeParse({
          ...valid,
          agreements: { ...agreements, [id]: false },
        }).success,
        id,
      ).toBe(false);
    }
  });

  it('the Hall download acknowledgment arrives with its current version', () => {
    expect(
      AcceptHallDownloadAcknowledgementInputSchema.safeParse({
        acknowledgementVersion: HALL_DOWNLOAD_ACKNOWLEDGEMENT_VERSION,
      }).success,
    ).toBe(true);
    expect(AcceptHallDownloadAcknowledgementInputSchema.safeParse({}).success).toBe(false);
  });

  it('a new public Realm requires its founding agreement; other creation modes refuse one', () => {
    const work = {
      workingTitle: 'Work',
      workingDescription: 'Desc',
      workProjectType: 'Tales',
      hallWingType: 'entertainment',
    };
    const publicRealm = {
      ...work,
      realmCreationMode: 'newPublicRealm',
      realmWorkingTitle: 'Realm',
      realmWorkingDescription: 'Realm desc',
    };
    expect(
      CreateWorkProjectInputSchema.safeParse({
        ...publicRealm,
        realmFoundingAgreementVersion: WORK_REALM_FOUNDING_AGREEMENT_VERSION,
      }).success,
    ).toBe(true);
    expect(CreateWorkProjectInputSchema.safeParse(publicRealm).success).toBe(false);
    expect(
      CreateWorkProjectInputSchema.safeParse({
        ...work,
        realmCreationMode: 'newStandaloneRealm',
        realmFoundingAgreementVersion: WORK_REALM_FOUNDING_AGREEMENT_VERSION,
      }).success,
    ).toBe(false);
  });

  it('a Hall submission carries only the current attestation wording version', () => {
    const shape = SubmitForThresholdLibraryReviewInputSchema.shape.attestationsVersion;
    expect(PUBLISH_ATTESTATIONS_VERSION).toBe(2);
    expect(shape.safeParse(2).success).toBe(true);
    expect(shape.safeParse(1).success).toBe(false);
    expect(shape.safeParse(3).success).toBe(false);
  });

  it('a text-only Commission proposal carries the current proposal agreement version', () => {
    const base = { commissionListingId: 'c1', coverLetterText: 'I can do this.' };
    expect(
      CreateCommissionProposalTextInputSchema.safeParse({
        ...base,
        agreementVersion: COMMISSION_PROPOSAL_AGREEMENT_VERSION,
      }).success,
    ).toBe(true);
    expect(CreateCommissionProposalTextInputSchema.safeParse(base).success).toBe(false);
    expect(
      CreateCommissionProposalTextInputSchema.safeParse({
        ...base,
        agreementVersion: COMMISSION_PROPOSAL_AGREEMENT_VERSION + 1,
      }).success,
    ).toBe(false);
  });

  it('each new agreement starts at its first wording version', () => {
    expect(AUDITION_ENTRY_AGREEMENT_VERSION).toBe(1);
    expect(COMMISSION_PROPOSAL_AGREEMENT_VERSION).toBe(1);
  });
});
