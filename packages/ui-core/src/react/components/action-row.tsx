"use client";

// A whole-row action that can still hold controls of its own (FRONTEND-001, FRONTEND-203). A row can
// never be a single <button> or <a>: a control inside it would be nested in the row's target. So the
// target is a sibling laid over the row, named by the row's content, and the content sits above it
// letting clicks through everywhere but on its own controls. The target comes first in tab order,
// then any control inside the row.

import * as React from "react";
import { cn } from "../../lib/utils.js";

const TARGET_CLASS =
  "peer absolute inset-0 w-full cursor-pointer transition-colors duration-[var(--motion-fast)] ease-[var(--motion-ease)] group-hover/action-row:bg-accent disabled:cursor-default disabled:group-hover/action-row:bg-transparent";

const CONTENT_CLASS =
  "relative pointer-events-none peer-disabled:opacity-70 [&_:is(a,button,input,select,textarea,[role=button])]:pointer-events-auto";

/** What the app's link element must carry to be a row's link target. */
export interface ActionRowLinkTargetProps {
  className: string;
  "aria-labelledby": string;
}

interface ActionRowCommonProps {
  /** Layout of the content (padding, flex, borders). */
  className?: string;
  children: React.ReactNode;
}

export interface ActionRowButtonProps extends ActionRowCommonProps {
  onClick: () => void;
  disabled?: boolean;
  /** The row's own action is in flight. */
  busy?: boolean;
  renderLink?: never;
}

export interface ActionRowLinkProps extends ActionRowCommonProps {
  /**
   * Renders the row's target as the app's own link element (its guarded in-app link), spreading
   * the given props onto it. The link takes no children: the row's content names it.
   */
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
        props.renderLink({ className: TARGET_CLASS, "aria-labelledby": contentId })
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
