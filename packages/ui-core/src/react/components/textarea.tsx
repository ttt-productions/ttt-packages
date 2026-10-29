'use client';

import * as React from 'react';
import type { DeclaredInputFormat } from '@ttt-productions/input-format-core';
import { cn } from '../../lib/utils.js';
import { formatControlAttributes, tidyOnBlur } from './format-control.js';

type NativeTextareaProps = React.ComponentPropsWithoutRef<'textarea'>;

export type FreeTextTextareaProps = Omit<
  NativeTextareaProps,
  'maxLength' | 'minLength' | 'required'
> & {
  inputFormat: DeclaredInputFormat;
  textEntry?: never;
};

export type NonFreeTextareaEntry = 'identifier' | 'list';

export type NonFreeTextTextareaProps = NativeTextareaProps & {
  textEntry: NonFreeTextareaEntry;
  inputFormat?: never;
} & ({ maxLength: number } | { readOnly: true });

export type TextareaProps = FreeTextTextareaProps | NonFreeTextTextareaProps;

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, inputFormat, textEntry: _textEntry, onBlur, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          'flex min-h-[80px] w-full rounded-md border-2 border-input bg-background px-3 py-2 text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
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
Textarea.displayName = 'Textarea';

export { Textarea };
