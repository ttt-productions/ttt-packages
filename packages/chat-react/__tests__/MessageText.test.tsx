import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { MessageText } from '../src/ui/MessageText.js';

describe('MessageText', () => {
  it('renders plain text unchanged', () => {
    const { container } = render(<MessageText text="hello world" />);
    expect(container.textContent).toBe('hello world');
  });

  it('renders token-looking text verbatim — there is no inline token grammar', () => {
    const { container } = render(<MessageText text="hi @[user:u1|Alice]!" />);
    expect(container.textContent).toBe('hi @[user:u1|Alice]!');
    // One wrapper span holding a single text node: nothing is parsed out into chips.
    const outer = container.firstElementChild as HTMLElement;
    expect(outer.tagName).toBe('SPAN');
    expect(outer.children.length).toBe(0);
  });

  it('applies className to the outer span', () => {
    const { container } = render(<MessageText text="hi" className="my-text" />);
    const outer = container.querySelector('.my-text');
    expect(outer).toBeTruthy();
    expect(outer?.textContent).toBe('hi');
  });

  it('renders empty string as an empty wrapper (no children)', () => {
    const { container } = render(<MessageText text="" />);
    const outer = container.firstChild as HTMLElement | null;
    expect(outer?.textContent).toBe('');
  });
});
