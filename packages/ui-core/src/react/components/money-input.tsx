'use client';

import * as React from 'react';
import {
  checkMoneyCents,
  formatMoney,
  moneyTextFromCents,
  readMoneyText,
  type DeclaredMoneyFormat,
} from '@ttt-productions/input-format-core';
import { Input } from './input.js';

type NativeInputProps = React.ComponentPropsWithoutRef<'input'>;

export type MoneyInputProps = Omit<
  NativeInputProps,
  | 'type'
  | 'value'
  | 'defaultValue'
  | 'onChange'
  | 'maxLength'
  | 'minLength'
  | 'pattern'
  | 'inputMode'
> & {
  moneyFormat: DeclaredMoneyFormat;
  cents: number | null;
  onCentsChange: (cents: number | null) => void;
};

function textForCents(cents: number | null): string {
  return cents === null ? '' : moneyTextFromCents(cents);
}

const MoneyInput = React.forwardRef<HTMLInputElement, MoneyInputProps>(
  ({ moneyFormat, cents, onCentsChange, 'aria-invalid': ariaInvalid, ...props }, ref) => {
    const [text, setText] = React.useState(() => textForCents(cents));
    const [heldCents, setHeldCents] = React.useState(cents);
    if (cents !== heldCents) {
      setHeldCents(cents);
      const typed = readMoneyText(text, moneyFormat);
      if (!typed.ok || typed.cents !== cents) setText(textForCents(cents));
    }

    const typed = readMoneyText(text, moneyFormat);
    const amount =
      typed.ok && typed.cents !== null ? checkMoneyCents(typed.cents, moneyFormat) : null;
    const overMax = amount !== null && !amount.ok && amount.issue === 'tooLarge';

    return (
      <Input
        {...props}
        ref={ref}
        type="text"
        textEntry="numeric"
        inputMode="decimal"
        maxLength={formatMoney(moneyFormat.maxCents).length}
        value={text}
        aria-invalid={ariaInvalid ?? (overMax ? true : undefined)}
        onChange={(event) => {
          const next = readMoneyText(event.target.value, moneyFormat);
          if (!next.ok) return;
          setText(event.target.value);
          setHeldCents(next.cents);
          onCentsChange(next.cents);
        }}
      />
    );
  },
);
MoneyInput.displayName = 'MoneyInput';

export { MoneyInput };
