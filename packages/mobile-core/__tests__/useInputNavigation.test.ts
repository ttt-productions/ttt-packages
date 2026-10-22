import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useInputNavigation } from '../src/react/keyboard/useInputNavigation.js';

describe('useInputNavigation', () => {
  let root: HTMLDivElement;

  beforeEach(() => {
    root = document.createElement('div');
    document.body.appendChild(root);
  });

  afterEach(() => {
    document.body.removeChild(root);
  });

  function customInput(attr: string): HTMLDivElement {
    const el = document.createElement('div');
    el.setAttribute(attr, '');
    el.tabIndex = 0;
    return el;
  }

  it('moves focus to the next input in order', () => {
    const first = document.createElement('input');
    const second = document.createElement('input');
    root.append(first, second);
    first.focus();

    const { result } = renderHook(() => useInputNavigation({ root }));
    result.current.focusNext();

    expect(document.activeElement).toBe(second);
  });

  it('moves focus to an input marked with the default prefix attribute', () => {
    const first = document.createElement('input');
    const custom = customInput('data-app-input');
    root.append(first, custom);
    first.focus();

    const { result } = renderHook(() => useInputNavigation({ root }));
    result.current.focusNext();

    expect(document.activeElement).toBe(custom);
  });

  it('moves focus to an input marked with the custom prefix attribute', () => {
    const first = document.createElement('input');
    const custom = customInput('data-x-input');
    root.append(first, custom);
    first.focus();
    const onDone = vi.fn();

    const { result } = renderHook(() => useInputNavigation({ root, cssPrefix: 'x', onDone }));
    result.current.focusNext();

    expect(document.activeElement).toBe(custom);
    expect(onDone).not.toHaveBeenCalled();
  });

  it('calls onDone after the last input', () => {
    const only = document.createElement('input');
    root.append(only);
    only.focus();
    const onDone = vi.fn();

    const { result } = renderHook(() => useInputNavigation({ root, onDone }));
    result.current.focusNext();

    expect(onDone).toHaveBeenCalledTimes(1);
  });
});
