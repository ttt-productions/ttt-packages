import { readFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, describe, it, expect, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { ClippedText } from '../src/react/components/clipped-text.js';
import { Toaster } from '../src/react/components/toaster.js';

const LONG = 'A title long enough that it never fits on one narrow line';
const CLIP_CLASSES = ['single-line-truncate', 'two-line-clamp', 'three-line-clamp', 'name-piece'];

const themeSheet = readFileSync(
  path.resolve(__dirname, '../../theme-core/src/styles/components.css'),
  'utf8',
);

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
    expect([...el.classList].filter((c) => CLIP_CLASSES.includes(c))).toEqual([clipClass]);
    expect(el).toHaveTextContent(LONG);
  });

  it("keeps the caller's className beside the clip class", () => {
    render(<ClippedText text={LONG} lines={2} className="font-bold" />);
    expect(screen.getByTitle(LONG)).toHaveClass('two-line-clamp', 'font-bold');
  });
});

describe('ClippedText — `as` names a plain tag, which is the clipped box itself', () => {
  afterEach(() => {
    document.head.querySelectorAll('style[data-theme-sheet]').forEach((s) => s.remove());
  });

  it('as a heading, the heading carries the clip with the text straight inside it, and is named by the full text', () => {
    render(<ClippedText as="h2" className="page-title" text={LONG} />);
    const heading = screen.getByRole('heading', { level: 2, name: LONG });
    expect(heading).toHaveAttribute('title', LONG);
    expect(heading).toHaveClass('single-line-truncate', 'page-title');
    expect([...heading.childNodes].map((n) => n.nodeType)).toEqual([Node.TEXT_NODE]);
  });

  it("clips on the caller's own box at the box's width: the heading itself hides the overflow behind an ellipsis", () => {
    const style = document.createElement('style');
    style.dataset.themeSheet = '';
    style.textContent = `${themeSheet}\n.narrow-title { display: block; width: 320px; }`;
    document.head.appendChild(style);

    render(<ClippedText as="h2" className="narrow-title" text={LONG} />);
    const computed = getComputedStyle(screen.getByRole('heading', { level: 2 }));
    expect(computed.width).toBe('320px');
    expect(computed.overflow).toBe('hidden');
    expect(computed.whiteSpace).toBe('nowrap');
    expect(computed.getPropertyValue('text-overflow')).toBe('ellipsis');
  });

  it("as a paragraph or a cell, the element keeps the caller's own props", () => {
    render(
      <table>
        <tbody>
          <tr>
            <ClippedText as="td" colSpan={2} text={LONG} lines={2} />
          </tr>
        </tbody>
      </table>,
    );
    const cell = screen.getByRole('cell', { name: LONG });
    expect(cell).toHaveAttribute('colspan', '2');
    expect(cell).toHaveClass('two-line-clamp');
    expect(cell).toHaveAttribute('title', LONG);
  });

  it('forwards its ref to the element it renders', () => {
    const ref = { current: null as HTMLElement | null };
    render(<ClippedText as="p" ref={ref} text={LONG} />);
    expect(ref.current?.tagName).toBe('P');
  });
});

describe('ClippedText — `asChild` is for a component, whose element becomes the clipped box', () => {
  function CardTitleLike(props: React.HTMLAttributes<HTMLHeadingElement>) {
    return <h3 data-part="card-title" {...props} />;
  }

  it("the component's element carries the clip and is named by the full text, keeping its own props", () => {
    render(
      <ClippedText asChild text={LONG} lines={3}>
        <CardTitleLike className="own-title" title="ignored" />
      </ClippedText>,
    );
    const heading = screen.getByRole('heading', { level: 3, name: LONG });
    expect(heading).toHaveAttribute('data-part', 'card-title');
    expect(heading).toHaveAttribute('title', LONG);
    expect(heading).toHaveClass('own-title', 'three-line-clamp');
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
    render(<ClippedText as="strong" text={name} namePieces />);
    const el = screen.getByTitle(name);
    expect(el.tagName).toBe('STRONG');
    expect(pieces(el)).toEqual([
      { text: 'Mary', clipsOnItsOwn: true },
      { text: 'Ann Van Der Berg', clipsOnItsOwn: true },
    ]);
    expect(el.textContent).toBe('Mary Ann Van Der Berg');
  });

  it('the outer element carries no line clip of its own', () => {
    render(<ClippedText text="John Smith" namePieces />);
    const el = screen.getByTitle('John Smith');
    for (const c of CLIP_CLASSES) expect(el).not.toHaveClass(c);
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

describe('ClippedText — the copy switch', () => {
  const UID = 'Xq7Lm2Pz9Wv4Rt8Yk1Bn5Hc3Df6Gj0Ns';
  const copiedToast = { title: 'Copied the ID', variant: 'success' as const };
  const failedToast = { title: 'Could not copy the ID', variant: 'destructive' as const };

  function stubClipboard(writeText: (value: string) => Promise<void>) {
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
  }

  afterEach(() => {
    Reflect.deleteProperty(navigator, 'clipboard');
  });

  it('types the switch so it is offered on a tag that may hold a button beside text, never on a heading, a link, a button or a component', () => {
    const copy = { title: 'user ID', copiedToast, failedToast };
    const compileOnly = () => (
      <>
        <ClippedText as="dd" text={UID} copy={copy} />
        {/* @ts-expect-error a heading is named by its text alone and takes no copy control */}
        <ClippedText as="h2" text={UID} copy={copy} />
        {/* @ts-expect-error a link takes no copy control inside it */}
        <ClippedText as="a" href="/somewhere" text={UID} copy={copy} />
        {/* @ts-expect-error a button cannot hold another button */}
        <ClippedText as="button" type="button" text={UID} copy={copy} />
        {/* @ts-expect-error a component under asChild takes no copy control */}
        <ClippedText asChild text={UID} copy={copy}>
          <span />
        </ClippedText>
      </>
    );
    expect(compileOnly).toBeTypeOf('function');
  });

  it('shows no copy control unless asked for', () => {
    render(<ClippedText text={UID} />);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it("shows the copy control after the clipped text; it copies the full value whatever is clipped and shows the app's copied wording", async () => {
    const writeText = vi.fn((_value: string) => Promise.resolve());
    stubClipboard(writeText);
    render(
      <>
        <p className="id-line">
          User ID: <ClippedText text={UID} copy={{ title: 'user ID', copiedToast, failedToast }} />
        </p>
        <Toaster />
      </>,
    );

    const clipped = screen.getByTitle(UID);
    expect(clipped).toHaveClass('single-line-truncate');
    const button = screen.getByRole('button', { name: 'Copy user ID' });
    expect(clipped.compareDocumentPosition(button) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(clipped.contains(button)).toBe(false);

    await act(async () => {
      fireEvent.click(button);
    });
    expect(writeText).toHaveBeenCalledWith(UID);
    expect(await screen.findByText('Copied the ID')).toBeInTheDocument();
  });

  it("keeps the caller's box: a cell stays the cell, holding the clipped text and the control", () => {
    render(
      <table>
        <tbody>
          <tr>
            <ClippedText as="td" text={UID} copy={{ title: 'user ID', copiedToast, failedToast }} />
          </tr>
        </tbody>
      </table>,
    );
    const cell = screen.getByRole('cell');
    expect(cell).toContainElement(screen.getByTitle(UID));
    expect(cell).toContainElement(screen.getByRole('button', { name: 'Copy user ID' }));
  });

  it("a failed copy shows the app's failure wording", async () => {
    stubClipboard(() => Promise.reject(new Error('denied')));
    render(
      <>
        <ClippedText text={UID} copy={{ title: 'user ID', copiedToast, failedToast }} />
        <Toaster />
      </>,
    );
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Copy user ID' }));
    });
    expect(await screen.findByText('Could not copy the ID')).toBeInTheDocument();
  });
});
