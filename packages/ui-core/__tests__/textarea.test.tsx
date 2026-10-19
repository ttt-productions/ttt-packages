import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import * as React from 'react';
import { defineInputFormat } from '@ttt-productions/input-format-core';
import { Textarea } from '../src/react/components/textarea.js';

const DESCRIPTION = defineInputFormat({ format: 'none', min: 1, max: 1000 });

describe('Textarea', () => {
  it('renders a textarea element', () => {
    const { container } = render(<Textarea inputFormat={DESCRIPTION} />);
    expect(container.querySelector('textarea')).toBeDefined();
  });

  it('accepts className and merges it', () => {
    const { container } = render(<Textarea inputFormat={DESCRIPTION} className="custom-class" />);
    const textarea = container.querySelector('textarea');
    expect(textarea?.className).toContain('custom-class');
  });

  it('accepts placeholder prop', () => {
    render(<Textarea inputFormat={DESCRIPTION} placeholder="Write here..." />);
    expect(screen.getByPlaceholderText('Write here...')).toBeDefined();
  });

  it('passes additional props', () => {
    render(<Textarea inputFormat={DESCRIPTION} data-testid="my-textarea" />);
    expect(screen.getByTestId('my-textarea')).toBeDefined();
  });

  it('renders as disabled when disabled prop is set', () => {
    const { container } = render(<Textarea inputFormat={DESCRIPTION} disabled />);
    const textarea = container.querySelector('textarea');
    expect(textarea?.disabled).toBe(true);
  });

  it('forwards ref to the textarea element', () => {
    const ref = React.createRef<HTMLTextAreaElement>();
    render(<Textarea inputFormat={DESCRIPTION} ref={ref} />);
    expect(ref.current).toBeInstanceOf(HTMLTextAreaElement);
  });

  // Every form control reads the one form-control edge token (--input), like Select.
  it('draws its edge from the form-control token, not the generic border', () => {
    const { container } = render(<Textarea inputFormat={DESCRIPTION} />);
    const el = container.querySelector('textarea')!;
    expect(el).toHaveClass('border-input');
    expect(el).not.toHaveClass('border-border');
  });
});

describe('a Textarea takes its bounds from its declaration', () => {
  it('caps the typed length at the declaration max', () => {
    render(<Textarea inputFormat={DESCRIPTION} />);
    expect(screen.getByRole('textbox')).toHaveAttribute('maxLength', '1000');
  });

  it('announces a field that cannot be blank as required, and an optional one as not', () => {
    const { rerender } = render(<Textarea inputFormat={DESCRIPTION} />);
    expect(screen.getByRole('textbox')).toHaveAttribute('aria-required', 'true');
    rerender(<Textarea inputFormat={defineInputFormat({ format: 'none', min: 0, max: 1000 })} />);
    expect(screen.getByRole('textbox')).not.toHaveAttribute('aria-required');
  });

  it('marks a line break in a single-line field as invalid, and accepts one where line breaks are allowed', () => {
    const { rerender } = render(
      <Textarea inputFormat={defineInputFormat({ format: 'singleLine', min: 1, max: 100 })} value={'two\nlines'} onChange={() => {}} />,
    );
    expect(screen.getByRole('textbox')).toHaveAttribute('aria-invalid', 'true');
    rerender(<Textarea inputFormat={DESCRIPTION} value={'two\nlines'} onChange={() => {}} />);
    expect(screen.getByRole('textbox')).not.toHaveAttribute('aria-invalid');
  });

  it('does not judge a read-only box: a stored value it shows is neither required nor invalid', () => {
    render(
      <Textarea inputFormat={defineInputFormat({ format: 'singleLine', min: 1, max: 100 })} value={'two\nlines'} readOnly />,
    );
    const box = screen.getByRole('textbox');
    expect(box).not.toHaveAttribute('aria-required');
    expect(box).not.toHaveAttribute('aria-invalid');
  });

  it('types its props so it needs a declaration and takes no length props', () => {
    const compileOnly = () => (
      <>
        {/* @ts-expect-error a textarea requires its declaration */}
        <Textarea />
        {/* @ts-expect-error the max comes from the declaration, never a maxLength prop */}
        <Textarea inputFormat={DESCRIPTION} maxLength={10} />
        {/* @ts-expect-error a bound is declared once, never written inline where it is enforced */}
        <Textarea inputFormat={{ format: 'none', min: 0, max: 10 }} />
        {/* @ts-expect-error required comes from the declaration's min */}
        <Textarea inputFormat={DESCRIPTION} required />
      </>
    );
    expect(compileOnly).toBeTypeOf('function');
  });
});

describe('a multi-line box that is not free text takes no input format', () => {
  it('renders an identifier list with no format, and keeps its own native bounds', () => {
    render(
      <Textarea
        textEntry="identifier"
        aria-label="User ids"
        maxLength={500}
        value={'uidA\nuid/B'}
        onChange={() => {}}
      />,
    );
    const box = screen.getByRole('textbox', { name: 'User ids' });
    expect(box).toHaveValue('uidA\nuid/B');
    expect(box).toHaveAttribute('maxLength', '500');
    expect(box).not.toHaveAttribute('aria-required');
    expect(box).not.toHaveAttribute('aria-invalid');
    expect(box).not.toHaveAttribute('textEntry');
  });

  it('a list box has no format of its own: no cap and no whole-box judgment', () => {
    const longList = Array.from({ length: 40 }, (_, i) => `term${i}`).join('\n');
    render(<Textarea textEntry="list" aria-label="Add words" value={longList} onChange={() => {}} />);
    const box = screen.getByRole('textbox', { name: 'Add words' });
    expect(box).toHaveValue(longList);
    expect(box).not.toHaveAttribute('maxLength');
    expect(box).not.toHaveAttribute('aria-invalid');
  });

  it('types the non-free-text branch so it refuses a declaration', () => {
    const compileOnly = () => (
      <>
        <Textarea textEntry="identifier" maxLength={500} required />
        <Textarea textEntry="list" />
        {/* @ts-expect-error a box that is not free text takes no declaration */}
        <Textarea textEntry="list" inputFormat={DESCRIPTION} />
        {/* @ts-expect-error only the named non-free-text entries exist */}
        <Textarea textEntry="numeric" />
      </>
    );
    expect(compileOnly).toBeTypeOf('function');
  });
});

describe('a free-text Textarea tidies its text when focus leaves it', () => {
  function Controlled({ initial, onBlur, readOnly }: { initial: string; onBlur?: () => void; readOnly?: boolean }) {
    const [value, setValue] = React.useState(initial);
    return (
      <>
        <Textarea inputFormat={DESCRIPTION} value={value} onChange={(e) => setValue(e.target.value)} onBlur={onBlur} readOnly={readOnly} />
        <output data-testid="parent-value">{value}</output>
      </>
    );
  }

  it('trims a none box on blur and keeps its inner spacing and line breaks', () => {
    render(<Controlled initial={'  one  two\n\nthree  '} />);
    fireEvent.blur(screen.getByRole('textbox'));
    expect(screen.getByRole('textbox')).toHaveValue('one  two\n\nthree');
    expect(screen.getByTestId('parent-value').textContent).toBe('one  two\n\nthree');
  });

  it("chains the caller's own onBlur", () => {
    const onBlur = vi.fn();
    render(<Controlled initial=" text " onBlur={onBlur} />);
    fireEvent.blur(screen.getByRole('textbox'));
    expect(onBlur).toHaveBeenCalledTimes(1);
  });

  it('never tidies a read-only box', () => {
    render(<Controlled initial=" text " readOnly />);
    fireEvent.blur(screen.getByRole('textbox'));
    expect(screen.getByRole('textbox')).toHaveValue(' text ');
  });
});
