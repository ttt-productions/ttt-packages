import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ShortLinkRedirector } from '../src/react/short-link-redirector.js';
import type { ShortLinkVisit } from '../src/react/short-link-redirector.js';

function renderVisit(visit: ShortLinkVisit) {
  const navigate = vi.fn();
  render(
    <ShortLinkRedirector
      visit={visit}
      navigate={navigate}
      pending={<p>pending</p>}
      missing={<p>missing</p>}
      failed={<p>failed</p>}
    />,
  );
  return navigate;
}

describe('ShortLinkRedirector', () => {
  it('replaces the page with an in-app destination', () => {
    const navigate = renderVisit({ status: 'found', destinationUrl: '/things/t1' });
    expect(navigate).toHaveBeenCalledWith('/things/t1', { replace: true });
    expect(screen.getByText('pending')).toBeTruthy();
  });

  it('treats a destination outside the app as a missing link and goes nowhere', () => {
    const navigate = renderVisit({ status: 'found', destinationUrl: '//elsewhere.test/x' });
    expect(navigate).not.toHaveBeenCalled();
    expect(screen.getByText('missing')).toBeTruthy();
  });

  it('shows the missing state for a link that does not exist', () => {
    const navigate = renderVisit({ status: 'missing' });
    expect(navigate).not.toHaveBeenCalled();
    expect(screen.getByText('missing')).toBeTruthy();
  });

  it('shows the failed state when the lookup failed', () => {
    renderVisit({ status: 'failed' });
    expect(screen.getByText('failed')).toBeTruthy();
  });

  it('shows the pending state while the lookup runs', () => {
    const navigate = renderVisit({ status: 'pending' });
    expect(navigate).not.toHaveBeenCalled();
    expect(screen.getByText('pending')).toBeTruthy();
  });
});
