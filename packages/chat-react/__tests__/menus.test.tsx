import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MessageActions, ThreadActions } from '../src/ui/menus.js';

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

describe('chat moderation actions', () => {
  it('a promise-returning Report shows pending and ignores a second click until it settles', async () => {
    const gate = deferred();
    const onReportMessage = vi.fn(() => gate.promise);
    render(<MessageActions messageId="m1" handlers={{ onReportMessage }} />);

    const report = screen.getByRole('button', { name: 'Report' });
    await act(async () => {
      fireEvent.click(report);
    });
    expect(report).toHaveAttribute('aria-busy', 'true');
    expect(report).toHaveAttribute('aria-disabled', 'true');
    fireEvent.click(report);
    expect(onReportMessage).toHaveBeenCalledTimes(1);
    expect(onReportMessage).toHaveBeenCalledWith('m1');

    await act(async () => {
      gate.resolve();
    });
    expect(screen.getByRole('button', { name: 'Report' })).not.toHaveAttribute('aria-busy');
  });

  it('a void handler runs once and leaves no pending state behind', async () => {
    const onReportThread = vi.fn();
    render(<ThreadActions threadId="t1" handlers={{ onReportThread }} />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Report thread' }));
    });
    expect(onReportThread).toHaveBeenCalledWith('t1');
    expect(screen.getByRole('button', { name: 'Report thread' })).not.toHaveAttribute('aria-busy');
  });

  it('offers only the member report actions, never an admin control', () => {
    render(
      <>
        <MessageActions messageId="m1" handlers={{ onReportMessage: vi.fn() }} />
        <ThreadActions threadId="t1" handlers={{ onReportThread: vi.fn() }} />
      </>,
    );
    expect(screen.getAllByRole('button').map((button) => button.textContent)).toEqual([
      'Report',
      'Report thread',
    ]);
  });
});
