import { describe, it, expect, beforeEach } from 'vitest';
import { getFocusableInputs } from '../src/keyboard/focusOrder';

function createElement(tag: string, attrs: Record<string, string> = {}): HTMLElement {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'contenteditable') {
      el.setAttribute('contenteditable', v);
    } else if (k === 'disabled') {
      el.setAttribute('disabled', '');
    } else if (k === 'tabindex') {
      el.tabIndex = parseInt(v);
    } else {
      el.setAttribute(k, v);
    }
  }
  return el;
}

describe('getFocusableInputs', () => {
  let root: HTMLDivElement;

  beforeEach(() => {
    root = document.createElement('div');
    document.body.appendChild(root);
  });

  afterEach(() => {
    document.body.removeChild(root);
  });

  it('finds input elements', () => {
    root.appendChild(createElement('input'));
    const result = getFocusableInputs(root);
    expect(result.length).toBe(1);
    expect(result[0].tagName).toBe('INPUT');
  });

  it('finds textarea elements', () => {
    root.appendChild(createElement('textarea'));
    const result = getFocusableInputs(root);
    expect(result.length).toBe(1);
    expect(result[0].tagName).toBe('TEXTAREA');
  });

  it('finds select elements', () => {
    root.appendChild(createElement('select'));
    const result = getFocusableInputs(root);
    expect(result.length).toBe(1);
    expect(result[0].tagName).toBe('SELECT');
  });

  it('finds contenteditable elements', () => {
    // In jsdom, div tabIndex defaults to -1 — must set 0 to be "focusable"
    const el = createElement('div', { contenteditable: 'true', tabindex: '0' });
    root.appendChild(el);
    const result = getFocusableInputs(root);
    expect(result.length).toBe(1);
  });

  it('finds elements with data-ttt-input attribute', () => {
    // In jsdom, div tabIndex defaults to -1 — must set 0 to be "focusable"
    const el = createElement('div', { 'data-ttt-input': '', tabindex: '0' });
    root.appendChild(el);
    const result = getFocusableInputs(root);
    expect(result).toContain(el);
  });

  it('excludes disabled elements', () => {
    root.appendChild(createElement('input', { disabled: '' }));
    const result = getFocusableInputs(root);
    expect(result.length).toBe(0);
  });

  it('excludes elements with tabIndex=-1', () => {
    const el = createElement('input', { tabindex: '-1' });
    root.appendChild(el);
    const result = getFocusableInputs(root);
    expect(result.length).toBe(0);
  });

  it('includes elements with tabIndex=0', () => {
    root.appendChild(createElement('input', { tabindex: '0' }));
    const result = getFocusableInputs(root);
    expect(result.length).toBe(1);
  });

  it('sorts by data-input-order when present', () => {
    const el1 = createElement('input');
    el1.setAttribute('data-input-order', '3');
    const el2 = createElement('input');
    el2.setAttribute('data-input-order', '1');
    const el3 = createElement('input');
    el3.setAttribute('data-input-order', '2');

    root.appendChild(el1);
    root.appendChild(el2);
    root.appendChild(el3);

    const result = getFocusableInputs(root);
    expect(result[0]).toBe(el2); // order 1
    expect(result[1]).toBe(el3); // order 2
    expect(result[2]).toBe(el1); // order 3
  });

  it('elements with data-input-order come before those without', () => {
    const withOrder = createElement('input');
    withOrder.setAttribute('data-input-order', '1');
    const withoutOrder = createElement('input');

    root.appendChild(withoutOrder); // DOM order first
    root.appendChild(withOrder);

    const result = getFocusableInputs(root);
    expect(result[0]).toBe(withOrder);
  });

  it('preserves DOM order for elements without data-input-order', () => {
    const el1 = createElement('input');
    const el2 = createElement('textarea');
    const el3 = createElement('select');

    root.appendChild(el1);
    root.appendChild(el2);
    root.appendChild(el3);

    const result = getFocusableInputs(root);
    // All without data-input-order - relative order should be stable (DOM order within group)
    expect(result).toContain(el1);
    expect(result).toContain(el2);
    expect(result).toContain(el3);
  });

  it('returns empty array when no focusable elements', () => {
    root.appendChild(createElement('div'));
    root.appendChild(createElement('span'));
    expect(getFocusableInputs(root)).toEqual([]);
  });

  it('uses document as default root', () => {
    // Doesn't throw when called with document
    expect(() => getFocusableInputs(document)).not.toThrow();
  });
});
