import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as React from 'react';
import { defineMoneyFormat, type DeclaredMoneyFormat } from '@ttt-productions/input-format-core';
import { MoneyInput } from '../src/react/components/money-input.js';

const UP_TO_500K = defineMoneyFormat({ minCents: 0, maxCents: 50_000_000 });
const FROM_2_50 = defineMoneyFormat({ minCents: 250, maxCents: 50_000_000 });

function Controlled({
  initial = null,
  onCents = () => {},
  format = UP_TO_500K,
}: {
  initial?: number | null;
  onCents?: (cents: number | null) => void;
  format?: DeclaredMoneyFormat;
}) {
  const [cents, setCents] = React.useState<number | null>(initial);
  return (
    <>
      <MoneyInput
        aria-label="Amount"
        moneyFormat={format}
        cents={cents}
        onCentsChange={(next) => {
          setCents(next);
          onCents(next);
        }}
      />
      <button type="button" onClick={() => setCents(12_345)}>
        Set from outside
      </button>
    </>
  );
}
Controlled.displayName = 'Controlled';

const box = () => screen.getByRole('textbox', { name: 'Amount' });

describe('MoneyInput', () => {
  it('shows a stored amount as dollars and two cent digits', () => {
    render(<Controlled initial={100_050} />);
    expect(box()).toHaveValue('1000.50');
  });

  it('shows an empty box for no amount', () => {
    render(<Controlled />);
    expect(box()).toHaveValue('');
  });

  it('hands the typed dollars to its consumer as whole cents', async () => {
    const onCents = vi.fn();
    render(<Controlled onCents={onCents} />);
    await userEvent.type(box(), '1000.5');
    expect(box()).toHaveValue('1000.5');
    expect(onCents).toHaveBeenLastCalledWith(100_050);
  });

  it('hands no amount to its consumer when the box is cleared', async () => {
    const onCents = vi.fn();
    render(<Controlled initial={500} onCents={onCents} />);
    await userEvent.clear(box());
    expect(onCents).toHaveBeenLastCalledWith(null);
  });

  it('refuses a dollar digit past the digit limit of the maximum', async () => {
    const onCents = vi.fn();
    render(<Controlled onCents={onCents} />);
    await userEvent.type(box(), '1234567');
    expect(box()).toHaveValue('123456');
    expect(onCents).toHaveBeenLastCalledWith(12_345_600);
  });

  it('refuses a third cent digit', async () => {
    render(<Controlled />);
    await userEvent.type(box(), '10.999');
    expect(box()).toHaveValue('10.99');
  });

  it('refuses letters and a minus sign', async () => {
    render(<Controlled />);
    await userEvent.type(box(), '-5a');
    expect(box()).toHaveValue('5');
  });

  it('does not count a dollar sign, commas, or the point toward the digit limit', async () => {
    const onCents = vi.fn();
    render(<Controlled onCents={onCents} />);
    await userEvent.type(box(), '$500,000.00');
    expect(box()).toHaveValue('$500,000.00');
    expect(onCents).toHaveBeenLastCalledWith(50_000_000);
  });

  it('marks an amount over the maximum invalid', async () => {
    render(<Controlled />);
    await userEvent.type(box(), '999999');
    expect(box()).toHaveAttribute('aria-invalid', 'true');
  });

  it('does not mark an amount below the minimum invalid while it is still being typed', async () => {
    render(<Controlled format={FROM_2_50} />);
    await userEvent.type(box(), '1');
    expect(box()).not.toHaveAttribute('aria-invalid');
  });

  it('shows an amount its consumer sets from outside', async () => {
    render(<Controlled />);
    await userEvent.type(box(), '5');
    await userEvent.click(screen.getByRole('button', { name: 'Set from outside' }));
    expect(box()).toHaveValue('123.45');
  });

  it('keeps the typed text while it already holds the consumer amount', async () => {
    render(<Controlled />);
    await userEvent.type(box(), '12.');
    expect(box()).toHaveValue('12.');
  });

  it('opens the decimal keypad and forwards its ref', () => {
    const ref = React.createRef<HTMLInputElement>();
    render(
      <MoneyInput
        ref={ref}
        aria-label="Amount"
        moneyFormat={UP_TO_500K}
        cents={null}
        onCentsChange={() => {}}
      />,
    );
    expect(box()).toHaveAttribute('inputMode', 'decimal');
    expect(ref.current).toBeInstanceOf(HTMLInputElement);
  });
});
