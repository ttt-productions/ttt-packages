import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React, { createRef } from 'react';
import type { DeferredUploadFormShellHandle } from '../src/react/deferred-upload-form-shell.js';

// --- mocks (must precede component imports) ---

vi.mock('@ttt-productions/file-input/react', () => ({
  MediaInput: ({ onChange, onClear, onCancel, selectedFile, uploadState }: any) =>
    React.createElement(
      'div',
      { 'data-testid': 'media-input' },
      React.createElement(
        'button',
        {
          type: 'button',
          'data-testid': 'select-file-btn',
          onClick: () =>
            onChange({ file: new File(['x'], 'test.jpg', { type: 'image/jpeg' }) }),
        },
        'Select File',
      ),
      selectedFile
        ? React.createElement('span', { 'data-testid': 'selected-file-name' }, selectedFile.name)
        : null,
      onClear
        ? React.createElement(
            'button',
            { type: 'button', onClick: onClear, 'data-testid': 'clear-file-btn' },
            'Clear',
          )
        : null,
      onCancel
        ? React.createElement(
            'button',
            { type: 'button', onClick: onCancel, 'data-testid': 'cancel-upload-btn' },
            'Cancel',
          )
        : null,
      uploadState
        ? React.createElement('span', { 'data-testid': 'upload-state-phase' }, uploadState.phase)
        : null,
    ),
}));

vi.mock('@ttt-productions/file-input', () => ({}));

vi.mock('@ttt-productions/ttt-core', () => ({
  TTT_MEDIA_SPECS: new Proxy({} as Record<string, object>, {
    get: () => ({ accept: 'image/*', label: 'Image' }),
  }),
}));

// --- component import (after mocks) ---
import { DeferredUploadFormShell } from '../src/react/deferred-upload-form-shell.js';

// --- helpers ---

function makeMutation(opts?: {
  mutateAsync?: (vars: any) => Promise<any>;
  isPending?: boolean;
}) {
  return {
    mutateAsync: opts?.mutateAsync ?? vi.fn().mockResolvedValue({ ok: true }),
    isPending: opts?.isPending ?? false,
  };
}

function renderShellWithRef(props?: Partial<React.ComponentProps<typeof DeferredUploadFormShell>>) {
  const mutation = props?.mutation ?? makeMutation();
  const buildVariables = props?.buildVariables ?? vi.fn((file, onProgress, signal) => ({ file, onProgress, signal }));
  const ref = createRef<DeferredUploadFormShellHandle>();
  const result = render(
    <DeferredUploadFormShell
      fileOrigin="streetz"
      mutation={mutation}
      buildVariables={buildVariables}
      ref={ref}
      {...(props as any)}
    />,
  );
  return { ...result, ref };
}

// --- tests ---

describe('DeferredUploadFormShell', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('selecting a file does not call mutateAsync', async () => {
    const user = userEvent.setup();
    const mutation = makeMutation();
    renderShellWithRef({ mutation });

    await user.click(screen.getByTestId('select-file-btn'));

    expect(mutation.mutateAsync).not.toHaveBeenCalled();
  });

  it('imperative submit calls mutateAsync with result of buildVariables(selectedFile, onProgress)', async () => {
    const user = userEvent.setup();
    const mutateAsync = vi.fn().mockResolvedValue({ ok: true });
    const mutation = makeMutation({ mutateAsync });
    const buildVariables = vi.fn((file, onProgress, signal) => ({ kind: 'file', file, onProgress, signal }));
    const { ref } = renderShellWithRef({ mutation, buildVariables });

    await user.click(screen.getByTestId('select-file-btn'));
    ref.current?.submit();

    await waitFor(() => expect(mutateAsync).toHaveBeenCalledOnce());
    const [vars] = mutateAsync.mock.calls[0];
    expect(vars.kind).toBe('file');
    expect(vars.file).toBeInstanceOf(File);
    expect(typeof vars.onProgress).toBe('function');
    expect(vars.signal).toBeInstanceOf(AbortSignal);
  });

  it('imperative submit with no file selected still calls mutateAsync', async () => {
    const mutateAsync = vi.fn().mockResolvedValue({ ok: true });
    const mutation = makeMutation({ mutateAsync });
    const buildVariables = vi.fn((file, onProgress, signal) => ({ kind: 'no-file', file, onProgress, signal }));
    const { ref } = renderShellWithRef({ mutation, buildVariables });

    ref.current?.submit();

    await waitFor(() => expect(mutateAsync).toHaveBeenCalledOnce());
    const [vars] = mutateAsync.mock.calls[0];
    expect(vars.kind).toBe('no-file');
    expect(vars.file).toBeNull();
  });

  it('submit focuses the file area when a file is attached', async () => {
    const user = userEvent.setup();
    let resolveMutation!: () => void;
    const mutateAsync = vi.fn(
      () => new Promise<{ ok: true }>((res) => { resolveMutation = () => res({ ok: true }); }),
    );
    const { container, ref } = renderShellWithRef({ mutation: makeMutation({ mutateAsync }) });

    await user.click(screen.getByTestId('select-file-btn'));
    ref.current?.submit();

    await waitFor(() => {
      const fileArea = container.querySelector('[aria-live="polite"]');
      expect(document.activeElement).toBe(fileArea);
    });

    resolveMutation();
  });

  it('submit does not focus the file area when no file is attached', async () => {
    const mutateAsync = vi.fn().mockResolvedValue({ ok: true });
    const mutation = makeMutation({ mutateAsync });
    const { container, ref } = renderShellWithRef({ mutation });

    ref.current?.submit();
    await waitFor(() => expect(mutateAsync).toHaveBeenCalledOnce());

    const fileArea = container.querySelector('[aria-live="polite"]');
    expect(document.activeElement).not.toBe(fileArea);
  });

  it('mutation.isPending blocks re-entry into submit', async () => {
    const mutateAsync = vi.fn().mockResolvedValue({ ok: true });
    const mutation = makeMutation({ mutateAsync, isPending: true });
    const { ref } = renderShellWithRef({ mutation });

    ref.current?.submit();

    // The handler short-circuits on isPending, so mutateAsync is never called.
    expect(mutateAsync).not.toHaveBeenCalled();
  });

  it('onSuccess fires after mutation.mutateAsync resolves', async () => {
    const onSuccess = vi.fn();
    const mutateAsync = vi.fn().mockResolvedValue({ ok: true });
    const { ref } = renderShellWithRef({ mutation: makeMutation({ mutateAsync }), onSuccess });

    ref.current?.submit();

    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith({ ok: true }));
  });

  it('onError fires after mutation.mutateAsync rejects', async () => {
    const onError = vi.fn();
    const error = new Error('upload failed');
    const mutateAsync = vi.fn().mockRejectedValue(error);
    const { ref } = renderShellWithRef({ mutation: makeMutation({ mutateAsync }), onError });

    ref.current?.submit();

    await waitFor(() => expect(onError).toHaveBeenCalledWith(error));
  });

  it('uploadState resets to null after terminal success', async () => {
    const user = userEvent.setup();
    const mutateAsync = vi.fn().mockResolvedValue({ ok: true });
    const { ref } = renderShellWithRef({ mutation: makeMutation({ mutateAsync }) });

    await user.click(screen.getByTestId('select-file-btn'));
    ref.current?.submit();

    await waitFor(() => expect(mutateAsync).toHaveBeenCalledOnce());
    expect(screen.queryByTestId('upload-state-phase')).toBeNull();
  });

  it('onFileChange fires on select, on clear, and on post-success reset', async () => {
    const user = userEvent.setup();
    const onFileChange = vi.fn();
    const mutateAsync = vi.fn().mockResolvedValue({ ok: true });
    const { ref } = renderShellWithRef({ mutation: makeMutation({ mutateAsync }), onFileChange });

    // 1. on select
    await user.click(screen.getByTestId('select-file-btn'));
    expect(onFileChange).toHaveBeenLastCalledWith(expect.any(File));

    // 2. on clear
    await user.click(screen.getByTestId('clear-file-btn'));
    expect(onFileChange).toHaveBeenLastCalledWith(null);

    // 3. on post-success reset
    await user.click(screen.getByTestId('select-file-btn'));
    ref.current?.submit();
    await waitFor(() => expect(mutateAsync).toHaveBeenCalledOnce());
    await waitFor(() => expect(onFileChange).toHaveBeenLastCalledWith(null));

    // Total call count: select (File), clear (null), select (File), success-reset (null) = 4
    expect(onFileChange).toHaveBeenCalledTimes(4);
  });

  it('clicking cancel aborts the in-flight signal, swallows AbortError, and resets selectedFile', async () => {
    const user = userEvent.setup();
    const onError = vi.fn();
    const onFileChange = vi.fn();

    // mutateAsync that listens to the signal and rejects with AbortError when aborted
    let capturedSignal: AbortSignal | undefined;
    const mutateAsync = vi.fn((vars: any) => {
      capturedSignal = vars.signal;
      return new Promise((_resolve, reject) => {
        vars.signal?.addEventListener('abort', () => {
          const err = Object.assign(new Error('aborted'), { name: 'AbortError' });
          reject(err);
        });
      });
    });

    const { ref } = renderShellWithRef({
      mutation: makeMutation({ mutateAsync }),
      onError,
      onFileChange,
    });

    // Select file
    await user.click(screen.getByTestId('select-file-btn'));
    expect(onFileChange).toHaveBeenLastCalledWith(expect.any(File));

    // Submit (kicks off mutateAsync, which now hangs on the signal)
    ref.current?.submit();
    await waitFor(() => expect(mutateAsync).toHaveBeenCalledOnce());
    expect(capturedSignal).toBeInstanceOf(AbortSignal);

    // Click cancel
    await user.click(screen.getByTestId('cancel-upload-btn'));

    // After cancel: onError NOT called (AbortError is swallowed)
    await waitFor(() => {
      expect(onFileChange).toHaveBeenLastCalledWith(null);
    });
    expect(onError).not.toHaveBeenCalled();
  });
});
