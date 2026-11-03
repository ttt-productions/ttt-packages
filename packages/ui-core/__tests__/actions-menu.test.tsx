import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {
  ActionsMenu,
  ActionMenuItem,
  AsyncActionMenuItem,
  OverlayActionItem,
} from '../src/react/components/actions-menu.js';
import { ConsequenceDialog } from '../src/react/components/consequence-dialog.js';

function openMenu() {
  const trigger = screen.getByRole('button', { name: 'More actions' });
  fireEvent.keyDown(trigger, { key: 'ArrowDown' });
  return trigger;
}

describe('ActionsMenu', () => {
  it('names its trigger, and says so when it holds no action', () => {
    render(<ActionsMenu label="Actions for Sam" emptyLabel="Nothing to do" />);
    fireEvent.keyDown(screen.getByRole('button', { name: 'Actions for Sam' }), {
      key: 'ArrowDown',
    });
    expect(screen.getByRole('menuitem', { name: 'Nothing to do' })).toHaveAttribute(
      'data-disabled',
    );
  });

  it('a destructive overlay item opens its confirmation, which survives the menu closing and runs on confirm', async () => {
    const onConfirm = vi.fn();
    render(
      <ActionsMenu>
        <OverlayActionItem
          label="Remove from team"
          render={({ open, onOpenChange }) => (
            <ConsequenceDialog
              open={open}
              onOpenChange={onOpenChange}
              title="Remove Sam?"
              confirmLabel="Remove"
              destructive
              onConfirm={onConfirm}
            />
          )}
        />
      </ActionsMenu>,
    );
    openMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Remove from team' }));

    expect(screen.queryByRole('menu')).toBeNull();
    const dialog = await screen.findByRole('alertdialog', { name: 'Remove Sam?' });
    expect(dialog).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Remove' }));
    await waitFor(() => expect(onConfirm).toHaveBeenCalledTimes(1));
  });

  it('cancelling the confirmation runs nothing and removes the dialog', async () => {
    const onConfirm = vi.fn();
    render(
      <ActionsMenu>
        <OverlayActionItem
          label="Delete"
          render={({ open, onOpenChange }) => (
            <ConsequenceDialog
              open={open}
              onOpenChange={onOpenChange}
              title="Delete it?"
              confirmLabel="Delete"
              onConfirm={onConfirm}
            />
          )}
        />
      </ActionsMenu>,
    );
    openMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Delete' }));
    await screen.findByRole('alertdialog', { name: 'Delete it?' });
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('a plain item closes the menu and runs once', () => {
    const onSelect = vi.fn();
    render(
      <ActionsMenu>
        <ActionMenuItem label="Download" onSelect={onSelect} />
      </ActionsMenu>,
    );
    openMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Download' }));
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('an async item holds the menu open while it runs, reports a failure, and closes after', async () => {
    let finish: (value?: unknown) => void = () => {};
    const onError = vi.fn();
    const onSelect = vi.fn(
      () =>
        new Promise((_, reject) => {
          finish = () => reject(new Error('refused'));
        }),
    );
    render(
      <ActionsMenu>
        <AsyncActionMenuItem label="Hide" onSelect={onSelect} onError={onError} />
      </ActionsMenu>,
    );
    const trigger = openMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Hide' }));
    expect(await screen.findByRole('menuitem', { name: 'Hide' })).toHaveAttribute(
      'aria-busy',
      'true',
    );
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' });
    expect(screen.getByRole('menu')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Hide' }));
    expect(onSelect).toHaveBeenCalledTimes(1);

    finish();
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
    expect(onError).toHaveBeenCalledTimes(1);
    expect(trigger).toHaveAttribute('data-state', 'closed');
  });

  it('opens from the keyboard, moves focus through its items, and returns focus to its trigger on Escape', async () => {
    render(
      <ActionsMenu>
        <ActionMenuItem label="First" onSelect={() => {}} />
        <ActionMenuItem label="Second" onSelect={() => {}} />
      </ActionsMenu>,
    );
    const trigger = screen.getByRole('button', { name: 'More actions' });
    trigger.focus();
    await userEvent.keyboard('{Enter}');
    const first = await screen.findByRole('menuitem', { name: 'First' });
    await waitFor(() => expect(first).toHaveFocus());
    await userEvent.keyboard('{ArrowDown}');
    expect(screen.getByRole('menuitem', { name: 'Second' })).toHaveFocus();
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
    expect(trigger).toHaveFocus();
  });

  it('an item outside the menu throws, naming the menu it needs', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<ActionMenuItem label="Lost" onSelect={() => {}} />)).toThrow(
      /inside <ActionsMenu>/,
    );
  });
});
