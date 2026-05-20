import { describe, it, expect, afterEach } from 'vitest';
import { render } from '@testing-library/react';
import { ViewportHeightSetter } from '../../src/react/components/ViewportHeightSetter';

afterEach(() => {
  ['app', 'x'].forEach((p) => {
    document.documentElement.style.removeProperty(`--${p}-vh`);
    document.documentElement.style.removeProperty(`--${p}-dvh`);
  });
});

describe('ViewportHeightSetter', () => {
  it('renders null (no DOM output)', () => {
    const { container } = render(<ViewportHeightSetter />);
    expect(container.firstChild).toBeNull();
  });

  it('sets --app-vh CSS variable by default', () => {
    Object.defineProperty(window, 'innerHeight', { value: 900, writable: true, configurable: true });
    render(<ViewportHeightSetter />);
    expect(document.documentElement.style.getPropertyValue('--app-vh')).toBeTruthy();
  });

  it('sets --x-vh when cssPrefix is "x"', () => {
    Object.defineProperty(window, 'innerHeight', { value: 900, writable: true, configurable: true });
    render(<ViewportHeightSetter cssPrefix="x" />);
    expect(document.documentElement.style.getPropertyValue('--x-vh')).toBeTruthy();
    expect(document.documentElement.style.getPropertyValue('--app-vh')).toBe('');
  });
});
