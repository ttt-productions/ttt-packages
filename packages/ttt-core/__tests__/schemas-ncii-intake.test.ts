import { describe, it, expect } from 'vitest';
import {
  TakeItDownIntakeBodySchema,
  SubmitInAppNciiRequestInputSchema,
} from '../src/schemas/ncii';
import {
  MAX_NCII_LOCATOR_URL_LENGTH,
  NCII_IDEMPOTENCY_KEY_MIN_LENGTH,
  NCII_IDEMPOTENCY_KEY_MAX_LENGTH,
  MAX_NCII_CONTACT_EMAIL_LENGTH,
  NCII_CONTACT_PHONE_MAX_LENGTH,
} from '../src/constants/business';

const body = {
  idempotencyKey: 'a'.repeat(NCII_IDEMPOTENCY_KEY_MIN_LENGTH),
  requesterRole: 'depictedPerson',
  locator: { kind: 'url', url: 'https://example.com/post/1' },
  requesterName: 'A Person',
  contactEmail: 'person@example.com',
  electronicSignature: { signedName: 'A Person', signedAt: 1, signatureMethod: 'typedName' },
  nonconsentStatement: 'I did not consent.',
  goodFaithCertification: true,
} as const;

describe('TakeItDownIntakeBodySchema — the public no-login intake', () => {
  it('accepts a complete body and defaults the supporting facts to empty', () => {
    const parsed = TakeItDownIntakeBodySchema.safeParse(body);
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.supportingFacts).toBe('');
  });

  it('carries an external URL only, never a platform-hosted locator', () => {
    expect(
      TakeItDownIntakeBodySchema.safeParse({ ...body, locator: { kind: 'mediaAsset', mediaAssetId: 'm1' } }).success,
    ).toBe(false);
  });

  it('requires at least one contact method', () => {
    const { contactEmail: _email, ...noContact } = body;
    expect(TakeItDownIntakeBodySchema.safeParse(noContact).success).toBe(false);
    expect(TakeItDownIntakeBodySchema.safeParse({ ...noContact, contactPhone: '5551234' }).success).toBe(true);
  });

  it('refuses a key the form does not send', () => {
    expect(TakeItDownIntakeBodySchema.safeParse({ ...body, somethingElse: 1 }).success).toBe(false);
    expect(
      TakeItDownIntakeBodySchema.safeParse({
        ...body,
        electronicSignature: { ...body.electronicSignature, extra: true },
      }).success,
    ).toBe(false);
  });

  it('bounds the locator URL, the idempotency key, the email, and the phone at their declared limits', () => {
    const longUrl = `https://example.com/${'x'.repeat(MAX_NCII_LOCATOR_URL_LENGTH)}`;
    expect(TakeItDownIntakeBodySchema.safeParse({ ...body, locator: { kind: 'url', url: longUrl } }).success).toBe(false);
    expect(
      TakeItDownIntakeBodySchema.safeParse({ ...body, idempotencyKey: 'a'.repeat(NCII_IDEMPOTENCY_KEY_MIN_LENGTH - 1) })
        .success,
    ).toBe(false);
    expect(
      TakeItDownIntakeBodySchema.safeParse({ ...body, idempotencyKey: 'a'.repeat(NCII_IDEMPOTENCY_KEY_MAX_LENGTH + 1) })
        .success,
    ).toBe(false);
    const longEmail = `${'a'.repeat(MAX_NCII_CONTACT_EMAIL_LENGTH)}@example.com`;
    expect(TakeItDownIntakeBodySchema.safeParse({ ...body, contactEmail: longEmail }).success).toBe(false);
    expect(
      TakeItDownIntakeBodySchema.safeParse({ ...body, contactPhone: '1'.repeat(NCII_CONTACT_PHONE_MAX_LENGTH + 1) })
        .success,
    ).toBe(false);
  });

  it('takes an authorized representative block with an optional authority reference', () => {
    const rep = {
      ...body,
      requesterRole: 'authorizedRepresentative',
      authorizedRepresentative: { representedPersonName: 'B Person', authorityBasis: 'Parent' },
      authorityCertification: true,
    };
    expect(TakeItDownIntakeBodySchema.safeParse(rep).success).toBe(true);
    expect(
      TakeItDownIntakeBodySchema.safeParse({
        ...rep,
        authorizedRepresentative: { ...rep.authorizedRepresentative, authorityEvidenceRef: '' },
      }).success,
    ).toBe(false);
  });

  it('carries the representative block exactly when the requester is an authorized representative', () => {
    const representative = { ...body, requesterRole: 'authorizedRepresentative', authorityCertification: true };
    const block = { representedPersonName: 'B Person', authorityBasis: 'Parent' };
    const missing = TakeItDownIntakeBodySchema.safeParse(representative);
    expect(missing.success).toBe(false);
    if (!missing.success) {
      expect(missing.error.issues[0]?.message).toBe(
        'An authorized representative request requires the authorizedRepresentative block.',
      );
    }
    expect(TakeItDownIntakeBodySchema.safeParse({ ...representative, authorizedRepresentative: block }).success).toBe(true);
    expect(TakeItDownIntakeBodySchema.safeParse({ ...body, authorizedRepresentative: block }).success).toBe(false);
  });
});

describe('the in-app and public statutory intakes share one rule for their common fields', () => {
  const inApp = {
    idempotencyKey: body.idempotencyKey,
    itemType: 'square-streetz-post',
    reportedItemId: 'post-1',
    nonconsentStatement: 'I did not consent.',
    signedName: 'A Person',
    goodFaithCertification: true,
    contactEmail: 'person@example.com',
  } as const;

  it('accepts the same idempotency key and contact shapes', () => {
    expect(SubmitInAppNciiRequestInputSchema.safeParse(inApp).success).toBe(true);
  });

  it('refuses the same oversize key and email, and a request with no contact method', () => {
    expect(
      SubmitInAppNciiRequestInputSchema.safeParse({ ...inApp, idempotencyKey: 'a'.repeat(NCII_IDEMPOTENCY_KEY_MAX_LENGTH + 1) })
        .success,
    ).toBe(false);
    const { contactEmail: _email, ...noContact } = inApp;
    expect(SubmitInAppNciiRequestInputSchema.safeParse(noContact).success).toBe(false);
  });
});
