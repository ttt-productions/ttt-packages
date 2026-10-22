import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getFocusableInputs } from '../src/react/keyboard/focusOrder.js';

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
    // jsdom gives a div tabIndex -1, so it needs 0 to count as focusable.
    const el = createElement('div', { contenteditable: 'true', tabindex: '0' });
    root.appendChild(el);
    const result = getFocusableInputs(root);
    expect(result.length).toBe(1);
  });

  it('finds elements with data-app-input attribute (default prefix)', () => {
    const el = createElement('div', { 'data-app-input': '', tabindex: '0' });
    root.appendChild(el);
    const result = getFocusableInputs(root);
    expect(result).toContain(el);
  });

  it('finds elements with custom prefix attribute when prefix is overridden', () => {
    const el = createElement('div', { 'data-x-input': '', tabindex: '0' });
    root.appendChild(el);
    const result = getFocusableInputs(root, 'x');
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
    expect(result[0]).toBe(el2);
    expect(result[1]).toBe(el3);
    expect(result[2]).toBe(el1);
  });

  it('elements with data-input-order come before those without', () => {
    const withOrder = createElement('input');
    withOrder.setAttribute('data-input-order', '1');
    const withoutOrder = createElement('input');

    root.appendChild(withoutOrder);
    root.appendChild(withOrder);

    const result = getFocusableInputs(root);
    expect(result[0]).toBe(withOrder);
  });

  it('preserves DOM order for elements without data-input-order', () => {
    const select = createElement('select');
    const input = createElement('input');
    const textarea = createElement('textarea');

    root.appendChild(select);
    root.appendChild(input);
    root.appendChild(textarea);

    expect(getFocusableInputs(root)).toEqual([select, input, textarea]);
  });

  it('returns empty array when no focusable elements', () => {
    root.appendChild(createElement('div'));
    root.appendChild(createElement('span'));
    expect(getFocusableInputs(root)).toEqual([]);
  });

  it('accepts the document as the root', () => {
    expect(() => getFocusableInputs(document)).not.toThrow();
  });
});
