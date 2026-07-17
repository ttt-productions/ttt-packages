import { describe, it, expect, vi } from 'vitest';
import { useState } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ConsequenceDialog } from '../src/react/components/consequence-dialog';

const noop = () => {};

describe('ConsequenceDialog', () => {
  describe('consequence slots', () => {
    it('renders each provided slot with its label, and omits absent slots', () => {
      render(
        <ConsequenceDialog
          open
          onOpenChange={noop}
          title="Do the thing?"
          immediateEffect="does X right now"
          delayedEffect="settles once the webhook lands"
          reversibility="cannot be undone"
          confirmLabel="Go"
          onConfirm={noop}
        />,
      );
      expect(screen.getByText('does X right now')).toBeInTheDocument();
      expect(screen.getByText('settles once the webhook lands')).toBeInTheDocument();
      expect(screen.getByText('cannot be undone')).toBeInTheDocument();
      // Consistent slot labels.
      expect(screen.getByText('Immediately')).toBeInTheDocument();
      expect(screen.getByText('Afterward')).toBeInTheDocument();
      expect(screen.getByText('Reversibility')).toBeInTheDocument();
    });

    it('omits the slot labels that were not supplied', () => {
      render(
        <ConsequenceDialog
          open
          onOpenChange={noop}
          title="Only reversibility"
          reversibility="can be superseded later"
          confirmLabel="Go"
          onConfirm={noop}
        />,
      );
      expect(screen.getByText('Reversibility')).toBeInTheDocument();
      expect(screen.queryByText('Immediately')).not.toBeInTheDocument();
      expect(screen.queryByText('Afterward')).not.toBeInTheDocument();
    });
  });

  describe('open model', () => {
    it('uncontrolled: the trigger opens the dialog', async () => {
      const user = userEvent.setup();
      render(
        <ConsequenceDialog
          trigger={<button type="button">Open me</button>}
          title="Uncontrolled title"
          reversibility="r"
          confirmLabel="Go"
          onConfirm={noop}
        />,
      );
      expect(screen.queryByText('Uncontrolled title')).not.toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'Open me' }));
      expect(screen.getByText('Uncontrolled title')).toBeInTheDocument();
    });

    it('controlled: the open prop drives visibility and cancel calls onOpenChange(false)', async () => {
      const user = userEvent.setup();
      const onOpenChange = vi.fn();
      const { rerender } = render(
        <ConsequenceDialog
          open={false}
          onOpenChange={onOpenChange}
          title="Controlled title"
          reversibility="r"
          confirmLabel="Go"
          onConfirm={noop}
        />,
      );
      expect(screen.queryByText('Controlled title')).not.toBeInTheDocument();

      rerender(
        <ConsequenceDialog
          open
          onOpenChange={onOpenChange}
          title="Controlled title"
          reversibility="r"
          confirmLabel="Go"
          onConfirm={noop}
        />,
      );
      expect(screen.getByText('Controlled title')).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  describe('reason gate', () => {
    function ReasonHarness({ minLength, maxLength }: { minLength?: number; maxLength?: number }) {
      const [value, setValue] = useState('');
      return (
        <ConsequenceDialog
          open
          onOpenChange={noop}
          title="Deny?"
          reversibility="r"
          reason={{ required: true, minLength, maxLength, label: 'Reason', value, onChange: setValue }}
          confirmLabel="Deny"
          onConfirm={noop}
        />
      );
    }

    it('a required reason disables confirm until non-empty', async () => {
      const user = userEvent.setup();
      render(<ReasonHarness />);
      const confirm = screen.getByRole('button', { name: 'Deny' });
      expect(confirm).toBeDisabled();
      await user.type(screen.getByRole('textbox'), 'because reasons');
      expect(confirm).toBeEnabled();
    });

    it('enforces an injected minLength', async () => {
      const user = userEvent.setup();
      render(<ReasonHarness minLength={5} />);
      const confirm = screen.getByRole('button', { name: 'Deny' });
      await user.type(screen.getByRole('textbox'), 'abc');
      expect(confirm).toBeDisabled();
      await user.type(screen.getByRole('textbox'), 'de');
      expect(confirm).toBeEnabled();
    });

    it('derives the Textarea maxLength from the injected constant', () => {
      render(<ReasonHarness maxLength={280} />);
      expect(screen.getByRole('textbox')).toHaveAttribute('maxLength', '280');
    });
  });

  describe('typed-confirmation gate', () => {
    it('disables confirm until the typed value matches the phrase exactly', async () => {
      const user = userEvent.setup();
      render(
        <ConsequenceDialog
          open
          onOpenChange={noop}
          title="Reopen?"
          reversibility="r"
          typedConfirmation={{ phrase: 'CONFIRM REOPEN' }}
          confirmLabel="Reopen"
          onConfirm={noop}
        />,
      );
      const confirm = screen.getByRole('button', { name: 'Reopen' });
      expect(confirm).toBeDisabled();
      await user.type(screen.getByRole('textbox'), 'CONFIRM');
      expect(confirm).toBeDisabled();
      await user.type(screen.getByRole('textbox'), ' REOPEN');
      expect(confirm).toBeEnabled();
    });
  });

  describe('pending model', () => {
    it('stays open with a visible spinner and disabled buttons while onConfirm is pending, then closes on resolve', async () => {
      const user = userEvent.setup();
      let resolveConfirm: (() => void) | undefined;
      const onConfirm = vi.fn(() => new Promise<void>((resolve) => { resolveConfirm = resolve; }));
      const onOpenChange = vi.fn();

      render(
        <ConsequenceDialog
          open
          onOpenChange={onOpenChange}
          title="Confirm action"
          reversibility="cannot be undone"
          confirmLabel="Do it"
          onConfirm={onConfirm}
        />,
      );

      await user.click(screen.getByRole('button', { name: 'Do it' }));
      expect(onConfirm).toHaveBeenCalledTimes(1);

      // Visible Loader2 (spinner-xs), confirm + cancel disabled, dialog NOT closed yet.
      expect(document.querySelector('.spinner-xs')).toBeInTheDocument();
      const confirm = screen.getByRole('button', { name: 'Do it' });
      expect(confirm).toBeDisabled();
      expect(confirm).toHaveAttribute('aria-busy', 'true');
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
      expect(onOpenChange).not.toHaveBeenCalled();

      // Resolving closes the dialog (controlled → onOpenChange(false)).
      resolveConfirm?.();
      await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    });

    it('stays open when onConfirm rejects (caller surfaces the error)', async () => {
      const user = userEvent.setup();
      const onConfirm = vi.fn(() => Promise.reject(new Error('boom')));
      const onOpenChange = vi.fn();

      render(
        <ConsequenceDialog
          open
          onOpenChange={onOpenChange}
          title="Confirm action"
          reversibility="r"
          confirmLabel="Do it"
          onConfirm={onConfirm}
        />,
      );

      await user.click(screen.getByRole('button', { name: 'Do it' }));
      await waitFor(() => expect(onConfirm).toHaveBeenCalledTimes(1));
      // The dialog did not close — the operator can retry or cancel.
      expect(onOpenChange).not.toHaveBeenCalled();
      expect(screen.getByRole('button', { name: 'Do it' })).toBeEnabled();
    });
  });

  describe('destructive styling', () => {
    it('applies bg-destructive to the confirm button when destructive', () => {
      render(
        <ConsequenceDialog
          open
          onOpenChange={noop}
          title="Delete?"
          reversibility="cannot be undone"
          destructive
          confirmLabel="Delete"
          onConfirm={noop}
        />,
      );
      expect(screen.getByRole('button', { name: 'Delete' }).className).toContain('bg-destructive');
    });
  });
});
