import { describe, it, expect, afterEach, vi } from 'vitest';
import { render } from '@testing-library/react';

// The env flags the component reads, set per case: the mock reads them when it renders.
const env = vi.hoisted(() => ({ isBrowser: true, isIOS: false, isSafari: false }));
vi.mock('../../src/env.js', () => ({
  get isBrowser() {
    return env.isBrowser;
  },
  get isIOS() {
    return env.isIOS;
  },
  get isSafari() {
    return env.isSafari;
  },
}));

import { IOSSetup } from '../../src/react/components/IOSSetup.js';

afterEach(() => {
  document.documentElement.className = '';
  Object.assign(env, { isBrowser: true, isIOS: false, isSafari: false });
});

describe('IOSSetup', () => {
  it('renders null (no DOM output)', () => {
    const { container } = render(<IOSSetup />);
    expect(container.firstChild).toBeNull();
  });

  it('adds the app-ios-safari class on iOS Safari', () => {
    Object.assign(env, { isIOS: true, isSafari: true });
    render(<IOSSetup />);
    expect(document.documentElement.classList.contains('app-ios-safari')).toBe(true);
  });

  it('respects cssPrefix override', () => {
    Object.assign(env, { isIOS: true, isSafari: true });
    render(<IOSSetup cssPrefix="my" />);
    expect(document.documentElement.classList.contains('my-ios-safari')).toBe(true);
  });
});
