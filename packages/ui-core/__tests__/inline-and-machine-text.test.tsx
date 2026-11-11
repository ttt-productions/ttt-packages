import { readFileSync } from 'node:fs';
import path from 'node:path';
import * as React from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { InlineName } from '../src/react/components/inline-name.js';
import { MachineText } from '../src/react/components/machine-text.js';

const CLIP_CLASSES = ['single-line-truncate', 'two-line-clamp', 'three-line-clamp', 'name-piece'];

beforeEach(() => {
  const style = document.createElement('style');
  style.dataset.themeSheet = '';
  style.textContent = readFileSync(
    path.resolve(__dirname, '../../theme-core/src/styles/components.css'),
    'utf8',
  );
  document.head.appendChild(style);
});

afterEach(() => {
  document.head.querySelectorAll('style[data-theme-sheet]').forEach((s) => s.remove());
});

describe('InlineName — a name in a sentence is plain text that wraps with it', () => {
  it('reads as one run with the words and marks around it, with no gap: "Delete Hawks?"', () => {
    render(
      <h2>
        Delete <InlineName name="Hawks" />?
      </h2>,
    );
    expect(screen.getByRole('heading', { name: 'Delete Hawks?' })).toBeInTheDocument();
  });

  it('stays inline in the sentence, never a box, so it wraps with the sentence', () => {
    render(
      <p>
        Remove <InlineName name="Mary Ann Van Der Berg" /> from the team?
      </p>,
    );
    expect(getComputedStyle(screen.getByText('Mary Ann Van Der Berg')).display).toBe('inline');
  });

  it('breaks a long name that has no space mid-word, and never cuts it', () => {
    const name = 'Supercalifragilisticexpialidociousteamname';
    render(
      <p>
        Leave <InlineName name={name} />?
      </p>,
    );
    const el = screen.getByText(name);
    const computed = getComputedStyle(el);
    expect(computed.getPropertyValue('overflow-wrap')).toBe('anywhere');
    expect(computed.overflow).not.toBe('hidden');
    expect(computed.getPropertyValue('text-overflow')).not.toBe('ellipsis');
    expect(el).toHaveTextContent(name);
    for (const c of CLIP_CLASSES) expect(el).not.toHaveClass(c);
  });

  it('has no tooltip: the whole name is on the page', () => {
    render(<InlineName name="Hawks" />);
    expect(screen.getByText('Hawks')).not.toHaveAttribute('title');
  });
});

describe('MachineText — an id, an email, a hash or a file name breaks anywhere and is never cut', () => {
  const UID = 'Xq7Lm2Pz9Wv4Rt8Yk1Bn5Hc3Df6Gj0NsXq7Lm2Pz9Wv4Rt8Yk1Bn5Hc3Df6Gj0Ns';

  it('breaks at any character and never clips', () => {
    render(<MachineText text={UID} />);
    const el = screen.getByText(UID);
    const computed = getComputedStyle(el);
    expect(computed.getPropertyValue('word-break')).toBe('break-all');
    expect(computed.overflow).not.toBe('hidden');
    expect(computed.getPropertyValue('text-overflow')).not.toBe('ellipsis');
    expect(el).not.toHaveAttribute('title');
    for (const c of CLIP_CLASSES) expect(el).not.toHaveClass(c);
  });

  it("renders the caller's tag with its own props and class", () => {
    render(<MachineText as="code" className="font-mono" data-kind="hash" text="9f86d081884c" />);
    const el = screen.getByText('9f86d081884c');
    expect(el.tagName).toBe('CODE');
    expect(el).toHaveAttribute('data-kind', 'hash');
    expect(el).toHaveClass('machine-text', 'font-mono');
  });

  it("with asChild, a component's element breaks the text, keeping its own props and classes", () => {
    function CardTitleLike(props: React.HTMLAttributes<HTMLHeadingElement>) {
      return <h3 data-part="card-title" {...props} />;
    }
    render(
      <MachineText asChild className="font-mono" text={UID}>
        <CardTitleLike className="own-title" />
      </MachineText>,
    );
    const heading = screen.getByRole('heading', { level: 3, name: UID });
    expect(heading).toHaveAttribute('data-part', 'card-title');
    expect(heading).toHaveClass('machine-text', 'font-mono', 'own-title');
    expect([...heading.childNodes].map((n) => n.nodeType)).toEqual([Node.TEXT_NODE]);
    expect(getComputedStyle(heading).getPropertyValue('word-break')).toBe('break-all');
    expect(heading).not.toHaveAttribute('title');
  });

  it('forwards its ref to the element it renders, for a plain tag and for a component', () => {
    const tagRef = { current: null as HTMLElement | null };
    const childRef = { current: null as HTMLElement | null };
    const CardTitleLike = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLElement>>(
      (props, ref) => <h4 ref={ref} {...props} />,
    );
    CardTitleLike.displayName = 'CardTitleLike';
    render(
      <>
        <MachineText as="code" ref={tagRef} text="9f86d081884c" />
        <MachineText asChild ref={childRef} text={UID}>
          <CardTitleLike />
        </MachineText>
      </>,
    );
    expect(tagRef.current).toBe(screen.getByText('9f86d081884c'));
    expect(tagRef.current?.tagName).toBe('CODE');
    expect(childRef.current).toBe(screen.getByRole('heading', { level: 4, name: UID }));
  });
});
