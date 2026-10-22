import { useState } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import {
  createReloadRecoveryWatch,
  type ReloadRecoveryTarget,
} from '../src/browser/reload-recovery-watch.js';
import { ReloadRecoveryNotice } from '../src/react/components/reload-recovery-notice.js';

const DISCONNECT = new DOMException(
  'Connection to Indexed Database server lost. Refresh the page to try again',
  'UnknownError',
);
const MESSAGES = {
  storageDisconnect: 'Lost the connection to storage. Refresh to keep going.',
  staleChunk: 'A new version is ready. Refresh to load it.',
};

function page() {
  const target = new EventTarget();
  const watch = createReloadRecoveryWatch(target as unknown as ReloadRecoveryTarget);
  const fail = (reason: unknown) =>
    act(() => {
      target.dispatchEvent(Object.assign(new Event('unhandledrejection'), { reason }));
    });
  return { watch, fail };
}

function Editor() {
  const [text, setText] = useState('');
  return (
    <input aria-label="Draft" value={text} onChange={(event) => setText(event.target.value)} />
  );
}

function renderNotice(
  watch: ReturnType<typeof page>['watch'],
  onRefresh: () => Promise<unknown> = vi.fn(() => new Promise(() => {})),
  onRefreshError: (error: unknown) => void = vi.fn(),
) {
  return render(
    <>
      <ReloadRecoveryNotice
        watch={watch}
        messages={MESSAGES}
        refreshLabel="Refresh"
        onRefresh={onRefresh}
        onRefreshError={onRefreshError}
      />
      <Editor />
    </>,
  );
}

describe('ReloadRecoveryNotice', () => {
  it('shows nothing until a failure only a reload repairs', () => {
    const { watch } = page();
    renderNotice(watch);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it("shows the app's sentence for a lost storage connection, with Refresh and no way to dismiss it", () => {
    const { watch, fail } = page();
    renderNotice(watch);
    fail(DISCONNECT);
    const notice = screen.getByRole('alert');
    expect(notice).toHaveTextContent(MESSAGES.storageDisconnect);
    expect(screen.getAllByRole('button')).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Refresh' })).toBeInTheDocument();
  });

  it("shows the app's sentence for a stale chunk", () => {
    const { watch, fail } = page();
    renderNotice(watch);
    fail(new Error('Failed to load chunk 9'));
    expect(screen.getByRole('alert')).toHaveTextContent(MESSAGES.staleChunk);
  });

  it('shows a failure raised before it mounted', () => {
    const { watch, fail } = page();
    fail(DISCONNECT);
    renderNotice(watch);
    expect(screen.getByRole('alert')).toHaveTextContent(MESSAGES.storageDisconnect);
  });

  it('changes nothing on a repeat, or on the other failure after the first', () => {
    const { watch, fail } = page();
    renderNotice(watch);
    fail(DISCONNECT);
    fail(DISCONNECT);
    fail(new Error('Failed to load chunk 9'));
    expect(screen.getAllByRole('alert')).toHaveLength(1);
    expect(screen.getByRole('alert')).toHaveTextContent(MESSAGES.storageDisconnect);
  });

  it('keeps the page beneath mounted and usable, its typed input kept', () => {
    const { watch, fail } = page();
    renderNotice(watch);
    fireEvent.change(screen.getByLabelText('Draft'), { target: { value: 'half a memo' } });
    fail(DISCONNECT);
    expect(screen.getByLabelText('Draft')).toHaveValue('half a memo');
    fireEvent.change(screen.getByLabelText('Draft'), { target: { value: 'half a memo, more' } });
    expect(screen.getByLabelText('Draft')).toHaveValue('half a memo, more');
  });

  it("runs the app's reload once, pending while it runs, and never reloads by itself", () => {
    const { watch, fail } = page();
    const onRefresh = vi.fn(() => new Promise(() => {}));
    renderNotice(watch, onRefresh);
    fail(DISCONNECT);
    expect(onRefresh).not.toHaveBeenCalled();
    const refresh = screen.getByRole('button', { name: 'Refresh' });
    fireEvent.click(refresh);
    expect(onRefresh).toHaveBeenCalledTimes(1);
    expect(refresh).toHaveAttribute('aria-busy', 'true');
    fireEvent.click(refresh);
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it("leaves the notice and the page's input as they were when the app's guard cancels the reload", async () => {
    const { watch, fail } = page();
    const onRefresh = vi.fn(() => Promise.resolve(false));
    renderNotice(watch, onRefresh);
    fireEvent.change(screen.getByLabelText('Draft'), { target: { value: 'kept' } });
    fail(DISCONNECT);
    const refresh = screen.getByRole('button', { name: 'Refresh' });
    fireEvent.click(refresh);
    await waitFor(() => expect(refresh).not.toHaveAttribute('aria-busy'));
    expect(screen.getByRole('alert')).toHaveTextContent(MESSAGES.storageDisconnect);
    expect(screen.getByLabelText('Draft')).toHaveValue('kept');
  });

  it("hands a failed reload to the app's error handler and offers Refresh again", async () => {
    const { watch, fail } = page();
    const failure = new Error('reload refused');
    const onRefreshError = vi.fn();
    renderNotice(
      watch,
      vi.fn(() => Promise.reject(failure)),
      onRefreshError,
    );
    fail(DISCONNECT);
    const refresh = screen.getByRole('button', { name: 'Refresh' });
    fireEvent.click(refresh);
    await waitFor(() => expect(onRefreshError).toHaveBeenCalledWith(failure));
    expect(refresh).not.toHaveAttribute('aria-busy');
  });
});
