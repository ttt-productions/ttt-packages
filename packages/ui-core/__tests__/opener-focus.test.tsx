import { describe, it, expect, vi } from 'vitest';
import { useState } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogTrigger } from '../src/react/components/dialog';
import { Sheet, SheetContent, SheetTitle, SheetDescription } from '../src/react/components/sheet';
import { ConsequenceDialog } from '../src/react/components/consequence-dialog';

type CloseFocus = (event: Event) => void;

/** A dialog opened from state: its opener is an ordinary button, never a `DialogTrigger`. */
function StateDialog({ onCloseAutoFocus, removeOpenerOnClose = false }: { onCloseAutoFocus?: CloseFocus; removeOpenerOnClose?: boolean }) {
  const [open, setOpen] = useState(false);
  const [openerShown, setOpenerShown] = useState(true);
  return (
    <>
      {openerShown ? (
        <button type="button" onClick={() => setOpen(true)}>
          Edit game
        </button>
      ) : null}
      <button type="button">Elsewhere</button>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next && removeOpenerOnClose) setOpenerShown(false);
        }}
      >
        <DialogContent onCloseAutoFocus={onCloseAutoFocus}>
          <DialogTitle>Edit</DialogTitle>
          <DialogDescription>Change the game.</DialogDescription>
          <button type="button" onClick={() => setOpen(false)}>
            Save
          </button>
        </DialogContent>
      </Dialog>
    </>
  );
}

describe('focus as an overlay closes', () => {
  it('returns focus to the control that opened a dialog opened from state', async () => {
    const user = userEvent.setup();
    render(<StateDialog />);
    await user.click(screen.getByRole('button', { name: 'Edit game' }));
    await user.click(await screen.findByRole('button', { name: 'Save' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Edit game' })).toHaveFocus();
  });

  it('returns focus to the opener when the dialog closes on Escape', async () => {
    const user = userEvent.setup();
    render(<StateDialog />);
    await user.click(screen.getByRole('button', { name: 'Edit game' }));
    await screen.findByRole('dialog');
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Edit game' })).toHaveFocus();
  });

  it('leaves focus where the caller sent it when the caller prevents the return', async () => {
    const user = userEvent.setup();
    const onCloseAutoFocus = vi.fn((event: Event) => {
      event.preventDefault();
      screen.getByRole('button', { name: 'Elsewhere' }).focus();
    });
    render(<StateDialog onCloseAutoFocus={onCloseAutoFocus} />);
    await user.click(screen.getByRole('button', { name: 'Edit game' }));
    await user.click(await screen.findByRole('button', { name: 'Save' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(onCloseAutoFocus).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Elsewhere' })).toHaveFocus();
  });

  it('still returns focus to the opener after a caller handler that does not prevent it', async () => {
    const user = userEvent.setup();
    const onCloseAutoFocus = vi.fn();
    render(<StateDialog onCloseAutoFocus={onCloseAutoFocus} />);
    await user.click(screen.getByRole('button', { name: 'Edit game' }));
    await user.click(await screen.findByRole('button', { name: 'Save' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(onCloseAutoFocus).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Edit game' })).toHaveFocus();
  });

  it('closes cleanly when the opener has left the page', async () => {
    const user = userEvent.setup();
    render(<StateDialog removeOpenerOnClose />);
    await user.click(screen.getByRole('button', { name: 'Edit game' }));
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.queryByRole('button', { name: 'Edit game' })).not.toBeInTheDocument();
  });

  it('returns focus to the trigger of a dialog that has one', async () => {
    const user = userEvent.setup();
    render(
      <Dialog>
        <DialogTrigger asChild>
          <button type="button">Open</button>
        </DialogTrigger>
        <DialogContent>
          <DialogTitle>Title</DialogTitle>
          <DialogDescription>Body</DialogDescription>
        </DialogContent>
      </Dialog>,
    );
    await user.click(screen.getByRole('button', { name: 'Open' }));
    await screen.findByRole('dialog');
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Open' })).toHaveFocus();
  });

  it('returns focus to the control that opened a sheet opened from state', async () => {
    const user = userEvent.setup();
    function StateSheet() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>
            Filters
          </button>
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetContent>
              <SheetTitle>Filters</SheetTitle>
              <SheetDescription>Choose filters.</SheetDescription>
            </SheetContent>
          </Sheet>
        </>
      );
    }
    render(<StateSheet />);
    await user.click(screen.getByRole('button', { name: 'Filters' }));
    await screen.findByRole('dialog');
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Filters' })).toHaveFocus();
  });

  it('returns focus to the control that opened a confirmation opened from state', async () => {
    const user = userEvent.setup();
    function StateConfirmation() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>
            Remove member
          </button>
          <ConsequenceDialog
            open={open}
            onOpenChange={setOpen}
            title="Remove this member?"
            reversibility="They can be invited again."
            confirmLabel="Remove"
            onConfirm={() => undefined}
          />
        </>
      );
    }
    render(<StateConfirmation />);
    await user.click(screen.getByRole('button', { name: 'Remove member' }));
    await user.click(await screen.findByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Remove member' })).toHaveFocus();
  });
});
