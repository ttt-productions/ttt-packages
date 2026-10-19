import { describe, it, expect } from 'vitest';
import { THEME_NAMES } from '@ttt-productions/theme-core';
import { MAX_CONTACT_PHONE_LENGTH } from '../src/constants/business';
import { UserPrivateDataSchema, themeNameSchema } from '../src/doc-schemas/user-profile';
import {
  UpdateAccountSettingsInputSchema,
  UpdateAccountSettingsResultSchema,
} from '../src/schemas/account-settings';

const PRIVATE_DATA = { email: 'player@example.test', updatedAt: 1_700_000_000_000 };

describe('the saved theme', () => {
  it('is exactly theme-core\'s theme set, never a second union', () => {
    expect([...themeNameSchema.options]).toEqual([...THEME_NAMES]);
  });
});

describe('the account settings on privateData', () => {
  it('are optional: a copied or new account has saved none, and absent means use the device', () => {
    expect(UserPrivateDataSchema.safeParse(PRIVATE_DATA).success).toBe(true);
  });

  it('hold a theme from the theme set and a motion preference', () => {
    for (const theme of THEME_NAMES) {
      expect(UserPrivateDataSchema.safeParse({ ...PRIVATE_DATA, theme, reducedMotion: true }).success).toBe(true);
    }
  });

  it('hold the default contact phone exactly as the settings input accepts it: trimmed, one line, within its cap', () => {
    const parsed = UserPrivateDataSchema.safeParse({ ...PRIVATE_DATA, defaultContactPhone: '  555-0100  ' });
    expect(parsed.success && parsed.data.defaultContactPhone).toBe('555-0100');
    expect(UserPrivateDataSchema.safeParse({ ...PRIVATE_DATA, defaultContactPhone: '   ' }).success).toBe(false);
    expect(UserPrivateDataSchema.safeParse({ ...PRIVATE_DATA, defaultContactPhone: '555\n0100' }).success).toBe(false);
    expect(
      UserPrivateDataSchema.safeParse({ ...PRIVATE_DATA, defaultContactPhone: '5'.repeat(MAX_CONTACT_PHONE_LENGTH + 1) })
        .success,
    ).toBe(false);
  });

  it('refuse a theme outside the set and a non-boolean motion preference', () => {
    expect(UserPrivateDataSchema.safeParse({ ...PRIVATE_DATA, theme: 'sepia' }).success).toBe(false);
    expect(UserPrivateDataSchema.safeParse({ ...PRIVATE_DATA, reducedMotion: 'true' }).success).toBe(false);
  });
});

describe('UpdateAccountSettingsInputSchema', () => {
  it('takes any one setting, as the settings sync saves one change at a time', () => {
    expect(UpdateAccountSettingsInputSchema.safeParse({ theme: 'dark' }).success).toBe(true);
    expect(UpdateAccountSettingsInputSchema.safeParse({ reducedMotion: false }).success).toBe(true);
    expect(UpdateAccountSettingsInputSchema.safeParse({ defaultContactPhone: '555-0100' }).success).toBe(true);
  });

  it('takes several at once, as the compare prompt saves every differing setting together', () => {
    expect(UpdateAccountSettingsInputSchema.safeParse({ theme: 'high-contrast', reducedMotion: true }).success).toBe(
      true,
    );
  });

  it('clears the default contact phone with null', () => {
    expect(UpdateAccountSettingsInputSchema.safeParse({ defaultContactPhone: null }).success).toBe(true);
  });

  it('refuses a request that changes nothing', () => {
    expect(UpdateAccountSettingsInputSchema.safeParse({}).success).toBe(false);
  });

  it('refuses a user id, an email, or any other unknown field — the caller only ever changes their own', () => {
    expect(UpdateAccountSettingsInputSchema.safeParse({ theme: 'dark', userId: 'someone-else' }).success).toBe(false);
    expect(UpdateAccountSettingsInputSchema.safeParse({ email: 'x@example.test' }).success).toBe(false);
  });

  it('refuses a theme outside the set, a blank phone, and a phone over its cap', () => {
    expect(UpdateAccountSettingsInputSchema.safeParse({ theme: 'sepia' }).success).toBe(false);
    expect(UpdateAccountSettingsInputSchema.safeParse({ defaultContactPhone: '   ' }).success).toBe(false);
    expect(
      UpdateAccountSettingsInputSchema.safeParse({ defaultContactPhone: '5'.repeat(MAX_CONTACT_PHONE_LENGTH + 1) })
        .success,
    ).toBe(false);
  });

  it('answers with every setting as committed, null where nothing is saved', () => {
    expect(
      UpdateAccountSettingsResultSchema.safeParse({
        theme: 'dark',
        reducedMotion: null,
        defaultContactPhone: null,
        updatedAt: 5,
      }).success,
    ).toBe(true);
    expect(UpdateAccountSettingsResultSchema.safeParse({ theme: 'dark', updatedAt: 5 }).success).toBe(false);
    expect(
      UpdateAccountSettingsResultSchema.safeParse({
        theme: null,
        reducedMotion: null,
        defaultContactPhone: '5'.repeat(MAX_CONTACT_PHONE_LENGTH + 1),
        updatedAt: 5,
      }).success,
    ).toBe(false);
  });
});
