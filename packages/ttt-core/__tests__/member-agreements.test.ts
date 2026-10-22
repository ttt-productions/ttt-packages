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
  HALL_DOWNLOAD_ACKNOWLEDGEMENT_VERSION,
} from '../src/constants/member-agreements.js';
import { PUBLISH_NO_CREDITS_ATTESTATION } from '../src/constants/publish-attestations.js';
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

  it('become an Artisan: one location question, the merged 18+ box, AI, rights, Rules, and online-only', () => {
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
      rulesAndAgreements: 'I have read and agree to the Rules & Agreements.',
      collaborateOnline:
        "I'll collaborate online only. I won't use TTT to arrange meeting another member in person. In-person TTT work will only ever happen at official TTT Productions locations, and none exist yet.",
    });
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
        "Work's Guild — not paid to you personally.",
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
        'I own what I post. I give TTT a royalty-free license to host and show it here, and I let members make labeled, credited mimics of it.',
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

  it('craft statements say "craft", under a new statement version', () => {
    expect(CRAFT_SKILL_STATEMENT_VERSION).toBe(2);
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
    expect(shape.safeParse(1).success).toBe(true);
    expect(shape.safeParse(2).success).toBe(false);
  });
});
