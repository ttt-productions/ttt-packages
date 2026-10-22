'use client';

import type { MouseEvent, ReactNode } from 'react';
import { useLocalUploadGuard } from './local-upload-guard-provider.js';

export interface GuardedLinkRenderArgs {
  onClick: (event: MouseEvent<HTMLElement>) => void;
  children: ReactNode;
}

export interface GuardedLinkProps {
  children: ReactNode;
  renderLink: (args: GuardedLinkRenderArgs) => ReactNode;
}

export function GuardedLink(props: GuardedLinkProps) {
  const { children, renderLink } = props;
  const { confirmNavigation } = useLocalUploadGuard();

  const onClick = (event: MouseEvent<HTMLElement>) => {
    if (!confirmNavigation()) {
      event.preventDefault();
    }
  };

  return <>{renderLink({ onClick, children })}</>;
}
