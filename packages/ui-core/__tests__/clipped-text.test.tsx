import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ClippedText } from '../src/react/components/clipped-text.js';

const LONG = 'A title long enough that it never fits on one narrow line';

describe('ClippedText — line clips draw through the shared theme classes', () => {
  it('clips to one line by default, with the full text as its title', () => {
    render(<ClippedText text={LONG} />);
    const el = screen.getByTitle(LONG);
    expect(el.tagName).toBe('SPAN');
    expect(el).toHaveClass('single-line-truncate');
    expect(el).toHaveTextContent(LONG);
  });

  it.each([
    [1, 'single-line-truncate'],
    [2, 'two-line-clamp'],
    [3, 'three-line-clamp'],
  ] as const)('lines=%s carries .%s and no other clip class', (lines, clipClass) => {
    render(<ClippedText text={LONG} lines={lines} />);
    const el = screen.getByTitle(LONG);
    const clipClasses = [
      'single-line-truncate',
      'two-line-clamp',
      'three-line-clamp',
      'name-piece',
    ];
    expect([...el.classList].filter((c) => clipClasses.includes(c))).toEqual([clipClass]);
    expect(el).toHaveTextContent(LONG);
  });

  it("keeps the caller's className beside the clip class", () => {
    render(<ClippedText text={LONG} lines={2} className="font-bold" />);
    expect(screen.getByTitle(LONG)).toHaveClass('two-line-clamp', 'font-bold');
  });
});

describe('ClippedText — the rendered element is the caller’s', () => {
  it('as a heading, the heading carries the clip and the full text is its title and name', () => {
    render(
      <ClippedText asChild text={LONG}>
        <h1 />
      </ClippedText>,
    );
    const heading = screen.getByRole('heading', { level: 1, name: LONG });
    expect(heading).toHaveAttribute('title', LONG);
    expect(heading).toHaveClass('single-line-truncate');
  });

  it('as a link, the link keeps its own props and its name is the full text', () => {
    render(
      <ClippedText asChild text={LONG} lines={3}>
        <a href="/somewhere" className="own-link" title="ignored" />
      </ClippedText>,
    );
    const link = screen.getByRole('link', { name: LONG });
    expect(link).toHaveAttribute('href', '/somewhere');
    expect(link).toHaveAttribute('title', LONG);
    expect(link).toHaveClass('own-link', 'three-line-clamp');
  });

  it('inside a table cell, the cell is named by the full text', () => {
    render(
      <table>
        <tbody>
          <tr>
            <td>
              <ClippedText text={LONG} />
            </td>
          </tr>
        </tbody>
      </table>,
    );
    expect(screen.getByRole('cell', { name: LONG })).toBeInTheDocument();
    expect(screen.getByTitle(LONG)).toHaveClass('single-line-truncate');
  });
});

describe('ClippedText — a name in two pieces', () => {
  function pieces(el: Element) {
    return [...el.querySelectorAll(':scope > span')].map((s) => ({
      text: s.textContent,
      clipsOnItsOwn:
        s.classList.contains('name-piece') && s.classList.contains('single-line-truncate'),
    }));
  }

  it('splits at the first space; each piece clips on its own and the line breaks only between them', () => {
    const name = 'Mary Ann Van Der Berg';
    render(
      <ClippedText asChild text={name} namePieces>
        <a href="/profile" />
      </ClippedText>,
    );
    const link = screen.getByRole('link', { name });
    expect(link).toHaveAttribute('title', name);
    expect(pieces(link)).toEqual([
      { text: 'Mary', clipsOnItsOwn: true },
      { text: 'Ann Van Der Berg', clipsOnItsOwn: true },
    ]);
    expect(link.textContent).toBe('Mary Ann Van Der Berg');
  });

  it('the outer element carries no line clip of its own', () => {
    render(<ClippedText text="John Smith" namePieces />);
    const el = screen.getByTitle('John Smith');
    for (const c of ['single-line-truncate', 'two-line-clamp', 'three-line-clamp', 'name-piece'])
      expect(el).not.toHaveClass(c);
  });

  it('a one-word name is one piece', () => {
    render(<ClippedText text="onewordname42" namePieces />);
    const el = screen.getByTitle('onewordname42');
    expect(pieces(el)).toEqual([{ text: 'onewordname42', clipsOnItsOwn: true }]);
  });

  it('surrounding spaces are dropped from the pieces while the title keeps the text as given', () => {
    render(<ClippedText text="  John   Smith  " namePieces />);
    const el = screen.getByTitle('John Smith');
    expect(el).toHaveAttribute('title', '  John   Smith  ');
    expect(pieces(el)).toEqual([
      { text: 'John', clipsOnItsOwn: true },
      { text: 'Smith', clipsOnItsOwn: true },
    ]);
  });
});
