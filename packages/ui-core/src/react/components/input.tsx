'use client';

import * as React from 'react';
import type { DeclaredInputFormat } from '@ttt-productions/input-format-core';
import { cn } from '../../lib/utils.js';
import { formatControlAttributes, tidyOnBlur } from './format-control.js';

export type BuiltInFormatInputType =
  | 'password'
  | 'email'
  | 'number'
  | 'tel'
  | 'url'
  | 'search'
  | 'file'
  | 'color'
  | 'date'
  | 'datetime-local'
  | 'month'
  | 'week'
  | 'time'
  | 'range'
  | 'checkbox'
  | 'radio'
  | 'hidden'
  | 'button'
  | 'submit'
  | 'reset'
  | 'image';

type NativeInputProps = React.ComponentPropsWithoutRef<'input'>;

type LengthBound = { maxLength: number } | { readOnly: true };
type ValueBound = { max: number | string } | { readOnly: true };

export type LengthBoundInputType = 'email' | 'tel' | 'url' | 'search';

export type FreeTextInputProps = Omit<
  NativeInputProps,
  'type' | 'maxLength' | 'minLength' | 'pattern' | 'required'
> & {
  type?: 'text';
  inputFormat: DeclaredInputFormat;
  textEntry?: never;
};

export type NonFreeTextEntry = 'numeric' | 'identifier';

export type NonFreeTextInputProps = Omit<NativeInputProps, 'type'> & {
  type?: 'text';
  textEntry: NonFreeTextEntry;
  inputFormat?: never;
} & LengthBound;

export type LengthBoundInputProps = Omit<NativeInputProps, 'type'> & {
  type: LengthBoundInputType;
  inputFormat?: never;
  textEntry?: never;
} & LengthBound;

export type NumberInputProps = Omit<NativeInputProps, 'type'> & {
  type: 'number';
  inputFormat?: never;
  textEntry?: never;
} & ValueBound;

export type BuiltInFormatInputProps = Omit<NativeInputProps, 'type'> & {
  type: Exclude<BuiltInFormatInputType, LengthBoundInputType | 'number'>;
  inputFormat?: never;
  textEntry?: never;
};

export type InputProps =
  | FreeTextInputProps
  | NonFreeTextInputProps
  | LengthBoundInputProps
  | NumberInputProps
  | BuiltInFormatInputProps;

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, inputFormat, textEntry: _textEntry, onBlur, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          'flex h-10 w-full rounded-md border-2 border-input bg-background px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
          className,
        )}
        ref={ref}
        {...props}
        {...(inputFormat ? formatControlAttributes(inputFormat, props) : {})}
        onBlur={(event) => {
          if (inputFormat) tidyOnBlur(event.currentTarget, inputFormat);
          onBlur?.(event);
        }}
      />
    );
  },
);
Input.displayName = 'Input';

export { Input };
