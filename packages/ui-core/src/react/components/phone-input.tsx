'use client';

import * as React from 'react';
import {
  formatPhone,
  phoneTextMaxLength,
  readPhoneText,
  type DeclaredPhoneFormat,
  type PhoneTextResult,
} from '@ttt-productions/input-format-core';
import { Input } from './input.js';
import { replaceBoxText } from './format-control.js';

type NativeInputProps = React.ComponentPropsWithoutRef<'input'>;

export type PhoneInputProps = Omit<
  NativeInputProps,
  'type' | 'maxLength' | 'minLength' | 'pattern' | 'inputMode' | 'required'
> & {
  phoneFormat: DeclaredPhoneFormat;
};

function cannotBecomeValid(result: PhoneTextResult): boolean {
  return !result.ok && result.issue !== 'missing' && result.issue !== 'tooFewDigits';
}

const PhoneInput = React.forwardRef<HTMLInputElement, PhoneInputProps>(
  (
    {
      phoneFormat,
      onBlur,
      autoComplete = 'tel-national',
      'aria-required': ariaRequired,
      'aria-invalid': ariaInvalid,
      ...props
    },
    ref,
  ) => {
    const typed =
      typeof props.value === 'string' && !props.readOnly
        ? readPhoneText(props.value, phoneFormat)
        : null;

    return (
      <Input
        {...props}
        ref={ref}
        type="tel"
        inputMode="tel"
        autoComplete={autoComplete}
        maxLength={phoneTextMaxLength(phoneFormat)}
        aria-required={ariaRequired ?? (phoneFormat.required && !props.readOnly ? true : undefined)}
        aria-invalid={
          ariaInvalid ?? (typed !== null && cannotBecomeValid(typed) ? true : undefined)
        }
        onBlur={(event) => {
          const read = readPhoneText(event.currentTarget.value, phoneFormat);
          if (read.ok && read.digits !== null) {
            replaceBoxText(event.currentTarget, formatPhone(read.digits, phoneFormat));
          }
          onBlur?.(event);
        }}
      />
    );
  },
);
PhoneInput.displayName = 'PhoneInput';

export { PhoneInput };
