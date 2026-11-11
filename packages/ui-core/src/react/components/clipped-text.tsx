'use client';

import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';

import { cn } from '../../lib/utils.js';

export type ClippedTextLines = 1 | 2 | 3;

const LINE_CLASS: Record<ClippedTextLines, string> = {
  1: 'single-line-truncate',
  2: 'two-line-clamp',
  3: 'three-line-clamp',
};

const NAME_PIECE_CLASS = 'name-piece single-line-truncate';

export type ClippedTextClip =
  { lines?: ClippedTextLines; namePieces?: undefined } | { namePieces: true; lines?: undefined };

type ClippedTextElement =
  | { asChild?: false; children?: undefined }
  | { asChild: true; children: React.ReactElement<React.HTMLAttributes<HTMLElement>> };

export type ClippedTextProps = Omit<React.HTMLAttributes<HTMLElement>, 'children' | 'title'> &
  ClippedTextClip &
  ClippedTextElement & {
    text: string;
  };

function splitAtFirstSpace(text: string): { first: string; rest: string } {
  const trimmed = text.trim();
  const space = trimmed.indexOf(' ');
  if (space === -1) return { first: trimmed, rest: '' };
  return { first: trimmed.slice(0, space), rest: trimmed.slice(space + 1).trimStart() };
}

function NamePieces({ text }: { text: string }) {
  const { first, rest } = splitAtFirstSpace(text);
  return (
    <>
      <span className={NAME_PIECE_CLASS}>{first}</span>
      {rest ? (
        <>
          {' '}
          <span className={NAME_PIECE_CLASS}>{rest}</span>
        </>
      ) : null}
    </>
  );
}

const ClippedText = React.forwardRef<HTMLElement, ClippedTextProps>(
  ({ text, lines, namePieces, asChild, children, className, ...props }, ref) => {
    const element = asChild ? React.Children.only(children) : <span />;
    const content = namePieces ? <NamePieces text={text} /> : text;
    return (
      <Slot
        ref={ref}
        {...props}
        className={cn(namePieces ? undefined : LINE_CLASS[lines ?? 1], className)}
      >
        {React.cloneElement(element, { title: text }, content)}
      </Slot>
    );
  },
);
ClippedText.displayName = 'ClippedText';

export { ClippedText };
