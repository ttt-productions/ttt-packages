import { describe, it, expect, afterEach, vi } from 'vitest';
import { render } from '@testing-library/react';

afterEach(() => {
  document.documentElement.className = '';
  vi.resetModules();
});

describe('IOSSetup', () => {
  it('renders null (no DOM output)', async () => {
    vi.doMock('../../src/env', () => ({ isBrowser: true, isIOS: false, isSafari: false }));
    const { IOSSetup } = await import('../../src/react/components/IOSSetup');
    const { container } = render(<IOSSetup />);
    expect(container.firstChild).toBeNull();
  });

  it('adds the app-ios-safari class on iOS Safari', async () => {
    vi.doMock('../../src/env', () => ({ isBrowser: true, isIOS: true, isSafari: true }));
    const { IOSSetup } = await import('../../src/react/components/IOSSetup');
    render(<IOSSetup />);
    expect(document.documentElement.classList.contains('app-ios-safari')).toBe(true);
  });

  it('respects cssPrefix override', async () => {
    vi.doMock('../../src/env', () => ({ isBrowser: true, isIOS: true, isSafari: true }));
    const { IOSSetup } = await import('../../src/react/components/IOSSetup');
    render(<IOSSetup cssPrefix="my" />);
    expect(document.documentElement.classList.contains('my-ios-safari')).toBe(true);
  });
});
