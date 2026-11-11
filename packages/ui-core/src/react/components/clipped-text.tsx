'use client';

import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';

import { cn } from '../../lib/utils.js';
import { CopyButton, type CopyButtonWording } from './copy-button.js';

export type ClippedTextLines = 1 | 2 | 3;

const LINE_CLASS: Record<ClippedTextLines, string> = {
  1: 'single-line-truncate',
  2: 'two-line-clamp',
  3: 'three-line-clamp',
};

const NAME_PIECE_CLASS = 'name-piece single-line-truncate';

export type ClippedTextClip =
  { lines?: ClippedTextLines; namePieces?: undefined } | { namePieces: true; lines?: undefined };

export type ClippedTextCopyTag =
  | 'span'
  | 'p'
  | 'div'
  | 'li'
  | 'dt'
  | 'dd'
  | 'td'
  | 'th'
  | 'caption'
  | 'figcaption'
  | 'strong'
  | 'em'
  | 'small';

export type ClippedTextTag =
  | ClippedTextCopyTag
  | 'h1'
  | 'h2'
  | 'h3'
  | 'h4'
  | 'h5'
  | 'h6'
  | 'a'
  | 'button'
  | 'label'
  | 'legend';

type TagElement<T extends ClippedTextTag> = Omit<
  React.ComponentPropsWithoutRef<T>,
  'children' | 'title'
> & {
  asChild?: false;
  children?: undefined;
  copy?: T extends ClippedTextCopyTag ? CopyButtonWording : undefined;
};

type ClippedTextElement =
  | (TagElement<'span'> & { as?: 'span' })
  | { [T in Exclude<ClippedTextTag, 'span'>]: TagElement<T> & { as: T } }[Exclude<
      ClippedTextTag,
      'span'
    >]
  | (Omit<React.HTMLAttributes<HTMLElement>, 'children' | 'title'> & {
      asChild: true;
      as?: undefined;
      copy?: undefined;
      children: React.ReactElement<React.HTMLAttributes<HTMLElement>>;
    });

export type ClippedTextProps = ClippedTextClip &
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

type TagAttributes = React.AllHTMLAttributes<HTMLElement> & React.RefAttributes<HTMLElement>;

const COPY_ROW_CLASS = 'inline-flex max-w-full min-w-0 items-center gap-1 align-bottom';

const ClippedText = React.forwardRef<HTMLElement, ClippedTextProps>((props, ref) => {
  const clip = props.namePieces ? undefined : LINE_CLASS[props.lines ?? 1];
  const content = props.namePieces ? <NamePieces text={props.text} /> : props.text;

  if (props.asChild) {
    const {
      text,
      lines: _lines,
      namePieces: _namePieces,
      asChild: _asChild,
      as: _as,
      copy: _copy,
      children,
      className,
      ...own
    } = props;
    return (
      <Slot ref={ref} {...own} className={cn(clip, className)}>
        {React.cloneElement(React.Children.only(children), { title: text }, content)}
      </Slot>
    );
  }

  const {
    text,
    lines: _lines,
    namePieces: _namePieces,
    asChild: _asChild,
    as: tag = 'span',
    copy,
    children: _children,
    className,
    ...own
  } = props;

  const element: TagAttributes = { ...own, ref };

  if (copy)
    return React.createElement(
      tag,
      { ...element, className },
      <span className={COPY_ROW_CLASS}>
        <span className={clip} title={text}>
          {content}
        </span>
        <CopyButton value={text} {...copy} />
      </span>,
    );

  return React.createElement(
    tag,
    { ...element, className: cn(clip, className), title: text },
    content,
  );
});
ClippedText.displayName = 'ClippedText';

export { ClippedText };
