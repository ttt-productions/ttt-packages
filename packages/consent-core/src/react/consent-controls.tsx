'use client';

import type { ReactNode } from 'react';
import { Button, type ButtonProps } from '@ttt-productions/ui-core/react';
import { useConsent } from './consent-provider.js';

export interface CookieConsentBannerCopy {
  regionLabel: string;
  message: ReactNode;
  acceptLabel: string;
  declineLabel: string;
}

export interface CookieConsentBannerProps {
  copy: CookieConsentBannerCopy;
}

const CONSENT_BANNER_CLASS =
  'fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 backdrop-blur-sm p-4 ' +
  'pb-[max(1rem,env(safe-area-inset-bottom))] elevation-raised transition-opacity ' +
  'duration-[var(--motion-base)] ease-[var(--motion-ease)] starting:opacity-0 motion-reduce:transition-none';

export function CookieConsentBanner({ copy }: CookieConsentBannerProps) {
  const { consent, ready, accept, decline } = useConsent();

  if (!ready || consent !== 'unset') return null;

  // The bottom padding clears a phone's home indicator when the page draws under it
  // (`viewport-fit=cover`); the fade-in runs on the motion tokens, so an app's reduced-motion switch
  // and `prefers-reduced-motion` both stop it.
  return (
    <div role="region" aria-label={copy.regionLabel} className={CONSENT_BANNER_CLASS}>
      <div className="mx-auto flex max-w-4xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-small text-muted-foreground">{copy.message}</p>
        <div className="flex shrink-0 gap-2">
          <Button type="button" variant="default" size="sm" onClick={decline}>
            {copy.declineLabel}
          </Button>
          <Button type="button" size="sm" onClick={accept}>
            {copy.acceptLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

export type CookieSettingsButtonProps = Omit<ButtonProps, 'onClick' | 'type'>;

export function CookieSettingsButton(props: CookieSettingsButtonProps) {
  const { reopen } = useConsent();
  return <Button {...props} type="button" onClick={reopen} />;
}
