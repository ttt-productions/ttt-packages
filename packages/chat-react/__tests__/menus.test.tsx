import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MessageActions, ThreadActions } from '../src/ui/menus';

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

describe('chat moderation actions', () => {
  it('a promise-returning Delete shows pending and ignores a second click until it settles', async () => {
    const gate = deferred();
    const onDeleteMessage = vi.fn(() => gate.promise);
    render(<MessageActions messageId="m1" isAdmin handlers={{ onDeleteMessage }} />);

    const del = screen.getByRole('button', { name: 'Delete' });
    await act(async () => {
      fireEvent.click(del);
    });
    expect(del).toHaveAttribute('aria-busy', 'true');
    expect(del).toBeDisabled();
    fireEvent.click(del);
    expect(onDeleteMessage).toHaveBeenCalledTimes(1);
    expect(onDeleteMessage).toHaveBeenCalledWith('m1');

    await act(async () => {
      gate.resolve();
    });
    expect(screen.getByRole('button', { name: 'Delete' })).not.toHaveAttribute('aria-busy');
  });

  it('a void handler runs once and leaves no pending state behind', async () => {
    const onReportThread = vi.fn();
    render(<ThreadActions threadId="t1" isAdmin={false} handlers={{ onReportThread }} />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Report thread' }));
    });
    expect(onReportThread).toHaveBeenCalledWith('t1');
    expect(screen.getByRole('button', { name: 'Report thread' })).not.toHaveAttribute('aria-busy');
  });

  it('admin-only Delete thread stays hidden for non-admins', () => {
    render(<ThreadActions threadId="t1" isAdmin={false} handlers={{ onDeleteThread: vi.fn() }} />);
    expect(screen.queryByRole('button', { name: 'Delete thread' })).toBeNull();
  });
});
