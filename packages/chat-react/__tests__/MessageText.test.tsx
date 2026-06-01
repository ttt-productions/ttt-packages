import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { MessageText } from '../src/mentions/MessageText.js';

describe('MessageText', () => {
  it('renders plain text unchanged', () => {
    const { container } = render(<MessageText text="hello world" />);
    expect(container.textContent).toBe('hello world');
  });

  it('renders default chip for a mention with @ prefix and displayText', () => {
    const { container } = render(<MessageText text="hi @[user:u1|Alice]!" />);
    expect(container.textContent).toBe('hi @Alice!');
    const chip = container.querySelector('.chat-mention-chip');
    expect(chip).toBeTruthy();
    expect(chip?.getAttribute('data-mention-kind')).toBe('user');
    expect(chip?.getAttribute('data-mention-id')).toBe('u1');
  });

  it('uses custom renderMention when supplied', () => {
    const { container } = render(
      <MessageText
        text="hi @[user:u1|Alice]"
        renderMention={(ref) => <a data-testid="custom" href={`/users/${ref.id}`}>@{ref.displayText}</a>}
      />,
    );
    const custom = container.querySelector('[data-testid="custom"]');
    expect(custom).toBeTruthy();
    expect(custom?.getAttribute('href')).toBe('/users/u1');
    expect(custom?.textContent).toBe('@Alice');
  });

  it('renders multiple mentions interleaved with text', () => {
    const { container } = render(<MessageText text="@[user:a|A] then @[entity:e|E] end" />);
    expect(container.textContent).toBe('@A then @E end');
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
