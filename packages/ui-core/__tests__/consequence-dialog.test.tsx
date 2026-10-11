import { describe, it, expect, vi } from 'vitest';
import { useState } from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { defineInputFormat, type DeclaredInputFormat } from '@ttt-productions/input-format-core';

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

    it('renders every slot as a block row: its label on its own line, directly above its text', () => {
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
      const isBlock = (el: Element) => getComputedStyle(el).display === 'block';

      // The description the dialog announces holds the rows. Rows are blocks, which neither an
      // inline element nor a <p> can hold.
      const describedBy = screen.getByRole('alertdialog').getAttribute('aria-describedby');
      const description = describedBy ? document.getElementById(describedBy) : null;
      expect(description).not.toBeNull();
      expect(description!.tagName).not.toBe('P');
      expect(isBlock(description!)).toBe(true);

      for (const [label, text] of [
        ['Immediately', 'does X right now'],
        ['Afterward', 'settles once the webhook lands'],
        ['Reversibility', 'cannot be undone'],
      ]) {
        const labelEl = screen.getByText(label);
        const textEl = screen.getByText(text);
        expect(description!.contains(labelEl)).toBe(true);
        expect(isBlock(labelEl)).toBe(true);
        expect(isBlock(textEl)).toBe(true);
        expect(labelEl.nextElementSibling).toBe(textEl);
      }
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
    function ReasonHarness({ inputFormat }: { inputFormat: DeclaredInputFormat }) {
      const [value, setValue] = useState('');
      return (
        <ConsequenceDialog
          open
          onOpenChange={noop}
          title="Deny?"
          reversibility="r"
          reason={{ inputFormat, label: 'Reason', value, onChange: setValue }}
          confirmLabel="Deny"
          onConfirm={noop}
        />
      );
    }

    it('a reason that cannot be blank keeps confirm disabled until it holds more than whitespace', async () => {
      const user = userEvent.setup();
      render(<ReasonHarness inputFormat={defineInputFormat({ format: 'none', min: 1, max: 2000 })} />);
      const confirm = screen.getByRole('button', { name: 'Deny' });
      expect(confirm).toBeDisabled();
      await user.type(screen.getByRole('textbox'), '   ');
      expect(confirm).toBeDisabled();
      await user.type(screen.getByRole('textbox'), 'because reasons');
      expect(confirm).toBeEnabled();
    });

    it("enforces the declaration's min on the trimmed reason", async () => {
      const user = userEvent.setup();
      render(<ReasonHarness inputFormat={defineInputFormat({ format: 'none', min: 5, max: 2000 })} />);
      const confirm = screen.getByRole('button', { name: 'Deny' });
      await user.type(screen.getByRole('textbox'), ' abc  ');
      expect(confirm).toBeDisabled();
      await user.type(screen.getByRole('textbox'), 'de');
      expect(confirm).toBeEnabled();
    });

    it("refuses a reason with characters the declaration's format does not allow", async () => {
      const user = userEvent.setup();
      render(<ReasonHarness inputFormat={defineInputFormat({ format: 'singleLine', min: 1, max: 100 })} />);
      const confirm = screen.getByRole('button', { name: 'Deny' });
      await user.type(screen.getByRole('textbox'), 'first line');
      expect(confirm).toBeEnabled();
      await user.type(screen.getByRole('textbox'), '{Enter}second line');
      expect(confirm).toBeDisabled();
    });

    it('leaves confirm enabled for an empty optional reason', () => {
      render(<ReasonHarness inputFormat={defineInputFormat({ format: 'none', min: 0, max: 2000 })} />);
      expect(screen.getByRole('button', { name: 'Deny' })).toBeEnabled();
    });

    it('derives the Textarea maxLength from the declaration', () => {
      render(<ReasonHarness inputFormat={defineInputFormat({ format: 'none', min: 1, max: 280 })} />);
      expect(screen.getByRole('textbox')).toHaveAttribute('maxLength', '280');
    });

    it("renders the caller's hint under the reason box, and the box is described by it", async () => {
      const user = userEvent.setup();
      const inputFormat = defineInputFormat({ format: 'none', min: 10, max: 2000 });
      function HintHarness() {
        const [value, setValue] = useState('');
        return (
          <ConsequenceDialog
            open
            onOpenChange={noop}
            title="Reopen?"
            reversibility="r"
            reason={{
              inputFormat,
              label: 'Reason',
              value,
              onChange: setValue,
              hint: (id) => (
                <p id={id}>{value.trim().length > 0 && value.trim().length < 10 ? 'Too short.' : null}</p>
              ),
            }}
            confirmLabel="Reopen"
            onConfirm={noop}
          />
        );
      }
      render(<HintHarness />);
      const box = screen.getByRole('textbox', { name: 'Reason' });
      await user.type(box, 'short');
      expect(box).toHaveAccessibleDescription('Too short.');
      const hint = screen.getByText('Too short.');
      expect(box.parentElement!.contains(hint)).toBe(true);
    });

    it('describes the reason box by nothing when no hint is given', () => {
      render(<ReasonHarness inputFormat={defineInputFormat({ format: 'none', min: 1, max: 280 })} />);
      expect(screen.getByRole('textbox')).not.toHaveAttribute('aria-describedby');
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

    it('caps the typed confirmation at the length of the phrase', () => {
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
      expect(screen.getByRole('textbox')).toHaveAttribute('maxLength', String('CONFIRM REOPEN'.length));
    });
  });

  describe('pending model', () => {
    it('stays open with a visible spinner, an inert confirm, and a disabled cancel while onConfirm is pending, then closes on resolve', async () => {
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

      // Visible spinner, the pressed confirm inert but still focused, cancel disabled, dialog NOT closed yet.
      expect(document.querySelector('.spinner-xs')).toBeInTheDocument();
      const confirm = screen.getByRole('button', { name: 'Do it' });
      expect(confirm).toHaveAttribute('aria-disabled', 'true');
      expect(confirm).toHaveAttribute('aria-busy', 'true');
      expect(confirm).toHaveFocus();
      fireEvent.click(confirm);
      expect(onConfirm).toHaveBeenCalledTimes(1);
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

  describe('focus on close', () => {
    function FocusHarness({ onCloseAutoFocus }: { onCloseAutoFocus?: (event: Event) => void }) {
      return (
        <>
          <button type="button">Elsewhere</button>
          <ConsequenceDialog
            trigger={<button type="button">Delete game</button>}
            title="Delete this game?"
            reversibility="cannot be undone"
            confirmLabel="Delete"
            onConfirm={() => Promise.resolve()}
            onCloseAutoFocus={onCloseAutoFocus}
          />
        </>
      );
    }

    it('returns focus to the control that opened it once the confirmed action closes it', async () => {
      const user = userEvent.setup();
      render(<FocusHarness />);
      await user.click(screen.getByRole('button', { name: 'Delete game' }));
      await user.click(screen.getByRole('button', { name: 'Delete' }));
      await waitFor(() => expect(screen.queryByText('Delete this game?')).not.toBeInTheDocument());
      expect(screen.getByRole('button', { name: 'Delete game' })).toHaveFocus();
    });

    it('leaves focus where the caller moved it as it closes, instead of returning it to the opener', async () => {
      const user = userEvent.setup();
      const onCloseAutoFocus = vi.fn((event: Event) => {
        event.preventDefault();
        screen.getByRole('button', { name: 'Elsewhere' }).focus();
      });
      render(<FocusHarness onCloseAutoFocus={onCloseAutoFocus} />);
      await user.click(screen.getByRole('button', { name: 'Delete game' }));
      await user.click(screen.getByRole('button', { name: 'Delete' }));
      await waitFor(() => expect(screen.queryByText('Delete this game?')).not.toBeInTheDocument());
      expect(onCloseAutoFocus).toHaveBeenCalledTimes(1);
      expect(screen.getByRole('button', { name: 'Elsewhere' })).toHaveFocus();
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
