import { describe, it, expect } from 'vitest';
import { THEME_NAMES } from '@ttt-productions/theme-core';
import { ACCOUNT_EMAIL_MAX_LENGTH } from '@ttt-productions/auth-core';
import { UserPrivateDataSchema, themeNameSchema } from '../src/doc-schemas/user-profile.js';
import {
  UpdateUserProfileSettingsInputSchema,
  UpdateUserProfileSettingsResultSchema,
} from '../src/schemas/account-settings.js';

const PRIVATE_DATA = { email: 'player@example.test', updatedAt: 1_700_000_000_000 };

describe('the saved theme', () => {
  it("is exactly theme-core's theme set, never a second union", () => {
    expect([...themeNameSchema.options]).toEqual([...THEME_NAMES]);
  });
});

describe('the account settings on privateData', () => {
  it('are optional: a copied or new account has saved none, and absent means use the device', () => {
    expect(UserPrivateDataSchema.safeParse(PRIVATE_DATA).success).toBe(true);
  });

  it('hold an email no longer than the email limit the sign-in boxes take', () => {
    const email = (length: number) => `${'a'.repeat(length - '@example.test'.length)}@example.test`;
    expect(
      UserPrivateDataSchema.safeParse({ ...PRIVATE_DATA, email: email(ACCOUNT_EMAIL_MAX_LENGTH) })
        .success,
    ).toBe(true);
    expect(
      UserPrivateDataSchema.safeParse({
        ...PRIVATE_DATA,
        email: email(ACCOUNT_EMAIL_MAX_LENGTH + 1),
      }).success,
    ).toBe(false);
  });

  it('hold a theme from the theme set and a motion preference', () => {
    for (const theme of THEME_NAMES) {
      expect(
        UserPrivateDataSchema.safeParse({ ...PRIVATE_DATA, theme, reducedMotion: true }).success,
      ).toBe(true);
    }
  });

  it('hold the default contact phone as its 10 stored digits, never as typed', () => {
    const parsed = UserPrivateDataSchema.safeParse({
      ...PRIVATE_DATA,
      defaultContactPhone: '8148231858',
    });
    expect(parsed.success && parsed.data.defaultContactPhone).toBe('8148231858');
    for (const defaultContactPhone of ['814-823-1858', '555-0100', '18148231858', '0148231858']) {
      expect(
        UserPrivateDataSchema.safeParse({ ...PRIVATE_DATA, defaultContactPhone }).success,
      ).toBe(false);
    }
  });

  it('refuse a theme outside the set and a non-boolean motion preference', () => {
    expect(UserPrivateDataSchema.safeParse({ ...PRIVATE_DATA, theme: 'sepia' }).success).toBe(
      false,
    );
    expect(
      UserPrivateDataSchema.safeParse({ ...PRIVATE_DATA, reducedMotion: 'true' }).success,
    ).toBe(false);
  });
});

describe('UpdateUserProfileSettingsInputSchema', () => {
  it('takes any one setting, as the settings sync saves one change at a time', () => {
    expect(UpdateUserProfileSettingsInputSchema.safeParse({ theme: 'dark' }).success).toBe(true);
    expect(UpdateUserProfileSettingsInputSchema.safeParse({ reducedMotion: false }).success).toBe(
      true,
    );
    expect(
      UpdateUserProfileSettingsInputSchema.safeParse({ defaultContactPhone: '814-823-1858' })
        .success,
    ).toBe(true);
  });

  it('reads the phone the person typed to its 10 digits', () => {
    for (const defaultContactPhone of ['8148231858', '(814) 823-1858', '814.823.1858']) {
      const parsed = UpdateUserProfileSettingsInputSchema.safeParse({ defaultContactPhone });
      expect(parsed.success && parsed.data.defaultContactPhone).toBe('8148231858');
    }
  });

  it('takes several at once, as the compare prompt saves every differing setting together', () => {
    expect(
      UpdateUserProfileSettingsInputSchema.safeParse({
        theme: 'high-contrast',
        reducedMotion: true,
      }).success,
    ).toBe(true);
  });

  it('clears the default contact phone with null', () => {
    expect(
      UpdateUserProfileSettingsInputSchema.safeParse({ defaultContactPhone: null }).success,
    ).toBe(true);
  });

  it('refuses a request that changes nothing', () => {
    expect(UpdateUserProfileSettingsInputSchema.safeParse({}).success).toBe(false);
  });

  it('refuses a user id, an email, or any other unknown field — the caller only ever changes their own', () => {
    expect(
      UpdateUserProfileSettingsInputSchema.safeParse({ theme: 'dark', userId: 'someone-else' })
        .success,
    ).toBe(false);
    expect(
      UpdateUserProfileSettingsInputSchema.safeParse({ email: 'x@example.test' }).success,
    ).toBe(false);
  });

  it('refuses a theme outside the set, a blank phone, and a phone that is not a full US number', () => {
    expect(UpdateUserProfileSettingsInputSchema.safeParse({ theme: 'sepia' }).success).toBe(false);
    for (const defaultContactPhone of [
      '   ',
      '555-0100',
      '18148231858',
      '+1 814 823 1858',
      '014-823-1858',
    ]) {
      expect(UpdateUserProfileSettingsInputSchema.safeParse({ defaultContactPhone }).success).toBe(
        false,
      );
    }
  });

  it('answers with every setting as committed, null where nothing is saved', () => {
    expect(
      UpdateUserProfileSettingsResultSchema.safeParse({
        theme: 'dark',
        reducedMotion: null,
        defaultContactPhone: null,
        updatedAt: 5,
      }).success,
    ).toBe(true);
    expect(
      UpdateUserProfileSettingsResultSchema.safeParse({ theme: 'dark', updatedAt: 5 }).success,
    ).toBe(false);
    expect(
      UpdateUserProfileSettingsResultSchema.safeParse({
        theme: null,
        reducedMotion: null,
        defaultContactPhone: '814-823-1858',
        updatedAt: 5,
      }).success,
    ).toBe(false);
  });
});
