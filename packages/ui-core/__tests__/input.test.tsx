import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import * as React from 'react';
import { defineInputFormat } from '@ttt-productions/input-format-core';
import { Input } from '../src/react/components/input';

const TITLE = defineInputFormat({ format: 'englishNormal', min: 1, max: 150 });
const OPTIONAL_NOTE = defineInputFormat({ format: 'singleLine', min: 0, max: 500 });

describe('Input', () => {
  it('renders a text input', () => {
    render(<Input inputFormat={TITLE} />);
    expect(screen.getByRole('textbox')).toBeDefined();
  });

  it('accepts a built-in format type with no input format', () => {
    const { container } = render(<Input type="email" />);
    const input = container.querySelector('input');
    expect(input?.getAttribute('type')).toBe('email');
    expect(input?.hasAttribute('maxLength')).toBe(false);
  });

  it('accepts className and merges it', () => {
    const { container } = render(<Input inputFormat={TITLE} className="my-class" />);
    const input = container.querySelector('input');
    expect(input?.className).toContain('my-class');
  });

  it('passes additional props to the input element', () => {
    render(<Input inputFormat={TITLE} placeholder="Enter text" data-testid="my-input" />);
    expect(screen.getByTestId('my-input')).toBeDefined();
    expect(screen.getByPlaceholderText('Enter text')).toBeDefined();
  });

  it('renders as disabled when disabled prop is set', () => {
    const { container } = render(<Input inputFormat={TITLE} disabled />);
    const input = container.querySelector('input');
    expect(input?.disabled).toBe(true);
  });

  it('forwards ref to the input element', () => {
    const ref = React.createRef<HTMLInputElement>();
    render(<Input inputFormat={TITLE} ref={ref} />);
    expect(ref.current).toBeInstanceOf(HTMLInputElement);
  });

  // Every form control reads the one form-control edge token (--input), like Select.
  it('draws its edge from the form-control token, not the generic border', () => {
    const { container } = render(<Input inputFormat={TITLE} />);
    const el = container.querySelector('input')!;
    expect(el).toHaveClass('border-input');
    expect(el).not.toHaveClass('border-border');
  });
});

describe('a free-text Input takes its bounds from its declaration', () => {
  it('caps the typed length at the declaration max', () => {
    render(<Input inputFormat={TITLE} />);
    expect(screen.getByRole('textbox')).toHaveAttribute('maxLength', '150');
  });

  it('announces a field that cannot be blank as required, and an optional one as not', () => {
    const { rerender } = render(<Input inputFormat={TITLE} />);
    expect(screen.getByRole('textbox')).toHaveAttribute('aria-required', 'true');
    rerender(<Input inputFormat={OPTIONAL_NOTE} />);
    expect(screen.getByRole('textbox')).not.toHaveAttribute('aria-required');
  });

  it('marks a value with characters its format refuses as invalid', () => {
    render(<Input inputFormat={TITLE} value="Dragon's Lair" onChange={() => {}} />);
    expect(screen.getByRole('textbox')).toHaveAttribute('aria-invalid', 'true');
  });

  it('marks a value longer than the max as invalid', () => {
    render(<Input inputFormat={defineInputFormat({ format: 'none', min: 0, max: 3 })} value="abcd" onChange={() => {}} />);
    expect(screen.getByRole('textbox')).toHaveAttribute('aria-invalid', 'true');
  });

  it('does not mark an empty or half-typed required value as invalid while it is being typed', () => {
    const { rerender } = render(<Input inputFormat={TITLE} value="" onChange={() => {}} />);
    expect(screen.getByRole('textbox')).not.toHaveAttribute('aria-invalid');
    rerender(
      <Input inputFormat={defineInputFormat({ format: 'englishNormalNoSpaces', min: 3, max: 20 })} value="ab" onChange={() => {}} />,
    );
    expect(screen.getByRole('textbox')).not.toHaveAttribute('aria-invalid');
  });

  it('does not mark a well-formed value with surrounding spaces as invalid', () => {
    render(<Input inputFormat={TITLE} value="  Dragon Lands  " onChange={() => {}} />);
    expect(screen.getByRole('textbox')).not.toHaveAttribute('aria-invalid');
  });

  it("keeps the caller's own invalid state, as a form field passes it", () => {
    render(<Input inputFormat={TITLE} value="Dragon's Lair" onChange={() => {}} aria-invalid={false} />);
    expect(screen.getByRole('textbox')).toHaveAttribute('aria-invalid', 'false');
  });

  it('types its props so a free-text input needs a declaration and takes no length props', () => {
    const compileOnly = () => (
      <>
        {/* @ts-expect-error a free-text input requires its declaration */}
        <Input />
        {/* @ts-expect-error a text input requires its declaration */}
        <Input type="text" />
        {/* @ts-expect-error the max comes from the declaration, never a maxLength prop */}
        <Input inputFormat={TITLE} maxLength={10} />
        {/* @ts-expect-error a built-in format takes no declaration */}
        <Input type="search" inputFormat={TITLE} />
        <Input type="password" maxLength={128} />
        {/* @ts-expect-error a bound is declared once, never written inline where it is enforced */}
        <Input inputFormat={{ format: 'none', min: 0, max: 10 }} />
        {/* @ts-expect-error required comes from the declaration's min */}
        <Input inputFormat={TITLE} required />
      </>
    );
    expect(compileOnly).toBeTypeOf('function');
  });
});

describe('a text box that is not free text takes no input format', () => {
  it('keeps its own native bounds and input mode, and derives nothing', () => {
    render(<Input textEntry="numeric" inputMode="numeric" pattern="[0-9]*" maxLength={4} aria-label="Year" />);
    const input = screen.getByRole('textbox', { name: 'Year' });
    expect(input).toHaveAttribute('maxLength', '4');
    expect(input).toHaveAttribute('pattern', '[0-9]*');
    expect(input).toHaveAttribute('inputMode', 'numeric');
    expect(input).not.toHaveAttribute('aria-required');
    expect(input).not.toHaveAttribute('textEntry');
    expect(input).not.toHaveAttribute('textentry');
  });

  it('serves an identifier box with no format', () => {
    render(<Input type="text" textEntry="identifier" aria-label="Case id" value="case/1" onChange={() => {}} />);
    expect(screen.getByRole('textbox', { name: 'Case id' })).not.toHaveAttribute('aria-invalid');
  });

  it('types the exempt branch so it refuses a declaration', () => {
    const compileOnly = () => (
      <>
        <Input textEntry="numeric" inputMode="numeric" maxLength={2} required />
        {/* @ts-expect-error a text box that is not free text takes no declaration */}
        <Input textEntry="identifier" inputFormat={TITLE} />
        {/* @ts-expect-error only the two named kinds are exempt */}
        <Input textEntry="anything" />
        {/* @ts-expect-error a built-in format needs no exemption */}
        <Input type="email" textEntry="identifier" />
      </>
    );
    expect(compileOnly).toBeTypeOf('function');
  });
});
