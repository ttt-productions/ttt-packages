'use client';

import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';

import { cn } from '../../lib/utils.js';

export type MachineTextTag = 'span' | 'code' | 'p' | 'div' | 'li' | 'dd' | 'td' | 'pre';

type MachineTextAttributes = Omit<React.HTMLAttributes<HTMLElement>, 'children'>;

type MachineTextElement =
  | (MachineTextAttributes & { as?: MachineTextTag; asChild?: false; children?: undefined })
  | (MachineTextAttributes & {
      asChild: true;
      as?: undefined;
      children: React.ReactElement<React.HTMLAttributes<HTMLElement>>;
    });

export type MachineTextProps = MachineTextElement & { text: string };

const MACHINE_TEXT_CLASS = 'machine-text';

const MachineText = React.forwardRef<HTMLElement, MachineTextProps>((props, ref) => {
  if (props.asChild) {
    const { asChild: _asChild, as: _as, text, children, className, ...own } = props;
    return (
      <Slot ref={ref} {...own} className={cn(MACHINE_TEXT_CLASS, className)}>
        {React.cloneElement(React.Children.only(children), undefined, text)}
      </Slot>
    );
  }
  const {
    as: tag = 'span',
    asChild: _asChild,
    children: _children,
    text,
    className,
    ...own
  } = props;
  return React.createElement(
    tag,
    { ...own, ref, className: cn(MACHINE_TEXT_CLASS, className) },
    text,
  );
});
MachineText.displayName = 'MachineText';

export { MachineText };
