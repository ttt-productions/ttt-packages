'use client';

// A row is never one <button> or <a>: a control inside it would be nested in the row's target.

import * as React from 'react';
import { cn } from '../../lib/utils.js';

const TARGET_CLASS =
  'peer absolute inset-0 w-full cursor-pointer transition-colors duration-[var(--motion-fast)] ease-[var(--motion-ease)] group-hover/action-row:bg-accent disabled:cursor-default disabled:group-hover/action-row:bg-transparent';

const CONTENT_CLASS =
  'relative pointer-events-none peer-disabled:opacity-70 [&_:is(a,button,input,select,textarea,[role=button])]:pointer-events-auto';

export interface ActionRowLinkTargetProps {
  className: string;
  'aria-labelledby': string;
}

interface ActionRowCommonProps {
  className?: string;
  children: React.ReactNode;
}

export interface ActionRowButtonProps extends ActionRowCommonProps {
  onClick: () => void;
  disabled?: boolean;
  busy?: boolean;
  renderLink?: never;
}

export interface ActionRowLinkProps extends ActionRowCommonProps {
  renderLink: (target: ActionRowLinkTargetProps) => React.ReactElement;
  onClick?: never;
  disabled?: never;
  busy?: never;
}

export type ActionRowProps = ActionRowButtonProps | ActionRowLinkProps;

export function ActionRow(props: ActionRowProps) {
  const contentId = React.useId();
  return (
    <div className="ui-action-row group/action-row relative">
      {props.renderLink ? (
        props.renderLink({ className: TARGET_CLASS, 'aria-labelledby': contentId })
      ) : (
        <button
          type="button"
          className={TARGET_CLASS}
          onClick={props.onClick}
          disabled={props.disabled ?? false}
          aria-busy={props.busy || undefined}
          aria-labelledby={contentId}
        />
      )}
      <div id={contentId} className={cn(CONTENT_CLASS, props.className)}>
        {props.children}
      </div>
    </div>
  );
}
