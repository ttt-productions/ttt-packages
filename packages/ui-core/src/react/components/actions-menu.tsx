'use client';

// Dialogs render in the overlay slot, a sibling of the menu: the default-modal Radix DropdownMenu sets
// `pointer-events: none` on the page, and closing it unmounts its content subtree.

import * as React from 'react';
import { MoreHorizontal } from 'lucide-react';

import { Button } from './button.js';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './dropdown-menu.js';
import { useAsyncAction } from '../hooks/use-async-action.js';

export type OverlayRender = (props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) => React.ReactNode;

export interface ActionsMenuContextValue {
  closeMenu: () => void;
  showOverlay: (id: string, render: OverlayRender) => void;
  holdOpen: () => () => void;
}

const ActionsMenuContext = React.createContext<ActionsMenuContextValue | null>(null);

export function useActionsMenu(): ActionsMenuContextValue {
  const ctx = React.useContext(ActionsMenuContext);
  if (!ctx) {
    throw new Error('An actions-menu item must be rendered inside <ActionsMenu>.');
  }
  return ctx;
}

/** Long enough for the dialog's close animation to finish before it unmounts. */
const OVERLAY_UNMOUNT_DELAY_MS = 200;

function OverlayEntry({ render, onDone }: { render: OverlayRender; onDone: () => void }) {
  const [open, setOpen] = React.useState(true);
  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) {
      setTimeout(onDone, OVERLAY_UNMOUNT_DELAY_MS);
    }
  };
  return <>{render({ open, onOpenChange: handleOpenChange })}</>;
}

export interface ActionsMenuProps {
  children?: React.ReactNode;
  label?: string;
  emptyLabel?: string;
}

export function ActionsMenu({
  children,
  label = 'More actions',
  emptyLabel = 'No actions available',
}: ActionsMenuProps) {
  const [open, setOpen] = React.useState(false);
  const [overlays, setOverlays] = React.useState<Array<{ id: string; render: OverlayRender }>>([]);
  const [holds, setHolds] = React.useState(0);

  const closeMenu = React.useCallback(() => setOpen(false), []);
  const showOverlay = React.useCallback((id: string, render: OverlayRender) => {
    setOverlays((prev) => [...prev.filter((o) => o.id !== id), { id, render }]);
  }, []);
  const removeOverlay = React.useCallback((id: string) => {
    setOverlays((prev) => prev.filter((o) => o.id !== id));
  }, []);
  const holdOpen = React.useCallback(() => {
    setHolds((count) => count + 1);
    let released = false;
    return () => {
      if (released) return;
      released = true;
      setHolds((count) => count - 1);
    };
  }, []);

  const handleOpenChange = (next: boolean) => {
    if (!next && holds > 0) return;
    setOpen(next);
  };

  const ctx = React.useMemo<ActionsMenuContextValue>(
    () => ({ closeMenu, showOverlay, holdOpen }),
    [closeMenu, showOverlay, holdOpen],
  );

  const actions = React.Children.toArray(children);
  return (
    <ActionsMenuContext.Provider value={ctx}>
      <DropdownMenu open={open} onOpenChange={handleOpenChange}>
        <DropdownMenuTrigger asChild>
          <Button variant="default" size="icon" aria-label={label}>
            <MoreHorizontal className="icon-xs" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" variant="actions">
          {actions.length > 0 ? (
            children
          ) : (
            <DropdownMenuItem disabled>{emptyLabel}</DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      {overlays.map((o) => (
        <OverlayEntry key={o.id} render={o.render} onDone={() => removeOverlay(o.id)} />
      ))}
    </ActionsMenuContext.Provider>
  );
}

export interface ActionMenuItemProps {
  icon?: React.ReactNode;
  label: string;
  onSelect: () => void;
  disabled?: boolean;
}

export function ActionMenuItem({ icon, label, onSelect, disabled }: ActionMenuItemProps) {
  const { closeMenu } = useActionsMenu();

  const handleSelect = (event: Event) => {
    // preventDefault keeps Radix from unmounting the item mid-handler.
    event.preventDefault();
    closeMenu();
    onSelect();
  };

  return (
    <DropdownMenuItem
      className="cursor-pointer"
      disabled={disabled}
      icon={icon}
      onSelect={handleSelect}
    >
      {label}
    </DropdownMenuItem>
  );
}

export interface AsyncActionMenuItemProps {
  icon?: React.ReactNode;
  label: string;
  onSelect: () => Promise<unknown>;
  onError: (error: unknown) => void;
  disabled?: boolean;
}

export function AsyncActionMenuItem({
  icon,
  label,
  onSelect,
  onError,
  disabled,
}: AsyncActionMenuItemProps) {
  const { closeMenu, holdOpen } = useActionsMenu();
  const { run, pending } = useAsyncAction(onSelect, { onError });
  const runningRef = React.useRef(false);

  const handleSelect = (event: Event) => {
    event.preventDefault();
    if (runningRef.current) return;
    runningRef.current = true;
    const release = holdOpen();
    void run().then(() => {
      runningRef.current = false;
      release();
      closeMenu();
    });
  };

  return (
    <DropdownMenuItem
      className="cursor-pointer"
      disabled={disabled}
      pending={pending}
      icon={icon}
      onSelect={handleSelect}
    >
      {label}
    </DropdownMenuItem>
  );
}

export interface OverlayActionItemProps {
  icon?: React.ReactNode;
  label: string;
  render: OverlayRender;
  disabled?: boolean;
  pending?: boolean;
}

export function OverlayActionItem({
  icon,
  label,
  render,
  disabled,
  pending,
}: OverlayActionItemProps) {
  const { closeMenu, showOverlay } = useActionsMenu();
  const overlayId = React.useId();

  const handleSelect = (event: Event) => {
    event.preventDefault();
    closeMenu();
    showOverlay(overlayId, render);
  };

  return (
    <DropdownMenuItem
      className="cursor-pointer"
      disabled={disabled}
      pending={pending}
      icon={icon}
      onSelect={handleSelect}
    >
      {label}
    </DropdownMenuItem>
  );
}
