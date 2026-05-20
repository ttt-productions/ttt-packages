'use client';

/**
 * Render-prop link wrapper that guards navigation when an upload is in
 * progress. The consumer owns the actual navigator component (Next.js Link,
 * React Router Link, plain anchor, etc.) — this wrapper only injects the
 * onClick interceptor.
 *
 * Why render-prop and not `as={Link}`? Polymorphic `as` props create
 * notoriously bad TypeScript inference and force the wrapper to forward all
 * link-specific props. Render-prop keeps the consumer in full control of the
 * link API, costs one extra wrapper closure, and keeps upload-ui agnostic of
 * Next.js / React Router / etc.
 *
 * Design note: the design spec lists `<GuardedNavigationButton>` as a second
 * component. We deliberately don't ship it — buttons that navigate use
 * `useGuardedNavigation()` directly in one line. A second component would
 * split the same surface for no payoff.
 *
 * Usage:
 *
 *     <GuardedLink renderLink={({ onClick, children }) => (
 *       <Link href="/your/destination" onClick={onClick}>{children}</Link>
 *     )}>
 *       View all uploads →
 *     </GuardedLink>
 */

import type { MouseEvent, ReactNode } from 'react';
import { useLocalUploadGuard } from './local-upload-guard-provider.js';

export interface GuardedLinkRenderArgs {
  /** Click handler the consumer MUST attach to its underlying link element. */
  onClick: (event: MouseEvent<HTMLElement>) => void;
  /** The children passed to `<GuardedLink>` — forward them to the link. */
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
