import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as React from 'react';
import { definePhoneFormat, type DeclaredPhoneFormat } from '@ttt-productions/input-format-core';
import { PhoneInput } from '../src/react/components/phone-input.js';

const US_REQUIRED = definePhoneFormat({ format: 'us', required: true });
const US_OPTIONAL = definePhoneFormat({ format: 'us', required: false });

function Controlled({
  initial = '',
  onText = () => {},
  onBlur,
  format = US_REQUIRED,
}: {
  initial?: string;
  onText?: (text: string) => void;
  onBlur?: () => void;
  format?: DeclaredPhoneFormat;
}) {
  const [text, setText] = React.useState(initial);
  return (
    <>
      <PhoneInput
        aria-label="Phone"
        phoneFormat={format}
        value={text}
        onChange={(event) => {
          setText(event.target.value);
          onText(event.target.value);
        }}
        onBlur={onBlur}
      />
      <button type="button">Elsewhere</button>
    </>
  );
}

const box = () => screen.getByRole('textbox', { name: 'Phone' });
const leave = () => userEvent.click(screen.getByRole('button', { name: 'Elsewhere' }));

describe('PhoneInput', () => {
  it('shows a full number typed bare as the format shows it once focus leaves', async () => {
    const onText = vi.fn();
    render(<Controlled onText={onText} />);
    await userEvent.type(box(), '8148231858');
    expect(box()).toHaveValue('8148231858');
    await leave();
    expect(box()).toHaveValue('814-823-1858');
    expect(onText).toHaveBeenLastCalledWith('814-823-1858');
  });

  it('shows a number typed with other punctuation the same way', async () => {
    render(<Controlled />);
    await userEvent.type(box(), '(814) 823.1858');
    await leave();
    expect(box()).toHaveValue('814-823-1858');
  });

  it('leaves a number that is not yet valid exactly as typed', async () => {
    render(<Controlled />);
    await userEvent.type(box(), '555-0100');
    await leave();
    expect(box()).toHaveValue('555-0100');
  });

  it('runs its consumer’s own blur after showing the number', async () => {
    const onBlur = vi.fn(() => expect(box()).toHaveValue('814-823-1858'));
    render(<Controlled onBlur={onBlur} />);
    await userEvent.type(box(), '8148231858');
    await leave();
    expect(onBlur).toHaveBeenCalledTimes(1);
  });

  it('does not mark a number invalid while it is still being typed', async () => {
    render(<Controlled />);
    await userEvent.type(box(), '814-82');
    expect(box()).not.toHaveAttribute('aria-invalid');
  });

  it('marks a number that typing more cannot fix invalid', async () => {
    for (const text of ['+1 814', '014-823-1858', '18148231858']) {
      const { unmount } = render(<Controlled initial={text} />);
      expect(box()).toHaveAttribute('aria-invalid', 'true');
      unmount();
    }
  });

  it('is required when its declaration is, and optional otherwise', () => {
    const { unmount } = render(<Controlled />);
    expect(box()).toHaveAttribute('aria-required', 'true');
    unmount();
    render(<Controlled format={US_OPTIONAL} />);
    expect(box()).not.toHaveAttribute('aria-required');
  });

  it('is a phone box that holds the longest punctuated number and forwards its ref', () => {
    const ref = React.createRef<HTMLInputElement>();
    render(<PhoneInput ref={ref} aria-label="Phone" phoneFormat={US_REQUIRED} value="" readOnly />);
    expect(box()).toHaveAttribute('type', 'tel');
    expect(box()).toHaveAttribute('inputMode', 'tel');
    expect(Number(box().getAttribute('maxLength'))).toBeGreaterThanOrEqual(
      '( 814 ) 823 - 1858'.length,
    );
    expect(ref.current).toBeInstanceOf(HTMLInputElement);
  });
});
