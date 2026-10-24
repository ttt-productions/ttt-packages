export const CONSENT_STATES = ['granted', 'denied', 'unset'] as const;

export type ConsentState = (typeof CONSENT_STATES)[number];

export type StoredConsentChoice = Exclude<ConsentState, 'unset'>;

export function parseStoredConsent(stored: string): StoredConsentChoice | undefined {
  return stored === 'granted' || stored === 'denied' ? stored : undefined;
}
