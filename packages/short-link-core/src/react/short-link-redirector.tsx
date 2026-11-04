'use client';

import { useEffect, type ReactNode } from 'react';
import { isInAppDestination } from '../short-link-schema.js';

export type ShortLinkVisit =
  | { status: 'pending' }
  | { status: 'found'; destinationUrl: string }
  | { status: 'missing' }
  | { status: 'failed' };

export interface ShortLinkRedirectorProps {
  visit: ShortLinkVisit;
  navigate: (destinationUrl: string, options: { replace: true }) => unknown;
  pending: ReactNode;
  missing: ReactNode;
  failed: ReactNode;
}

export function ShortLinkRedirector({
  visit,
  navigate,
  pending,
  missing,
  failed,
}: ShortLinkRedirectorProps) {
  const destination = visit.status === 'found' ? visit.destinationUrl : null;
  const inApp = destination !== null && isInAppDestination(destination);

  useEffect(() => {
    if (destination !== null && inApp) void navigate(destination, { replace: true });
  }, [destination, inApp, navigate]);

  if (visit.status === 'failed') return <>{failed}</>;
  if (visit.status === 'missing' || (destination !== null && !inApp)) return <>{missing}</>;
  return <>{pending}</>;
}
