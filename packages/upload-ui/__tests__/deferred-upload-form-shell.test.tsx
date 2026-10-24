import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React, { createRef } from 'react';
import type {
  DeferredUploadFormShellHandle,
  DeferredUploadFormShellProps,
} from '../src/react/upload/deferred-upload-form-shell.js';
import type { MediaInputProps } from '@ttt-productions/file-input';
import type { MediaOriginSpec, UploadState } from '@ttt-productions/media-schemas';

// Mocks must precede the component imports.

vi.mock('@ttt-productions/file-input/react', () => ({
  MediaInput: ({
    spec,
    onChange,
    onClear,
    onCancel,
    selectedFile,
    uploadState,
  }: Pick<
    MediaInputProps,
    'spec' | 'onChange' | 'onClear' | 'onCancel' | 'selectedFile' | 'uploadState'
  >) =>
    React.createElement(
      'div',
      { 'data-testid': 'media-input' },
      React.createElement(
        'button',
        {
          type: 'button',
          'data-testid': 'select-file-btn',
          onClick: () =>
            onChange({
              spec,
              file: new File(['x'], 'test.jpg', { type: 'image/jpeg' }),
              claim: { kind: 'image', source: 'file-picker' },
            }),
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

import { DeferredUploadFormShell } from '../src/react/upload/deferred-upload-form-shell.js';

type TestVariables = {
  kind?: 'file' | 'no-file';
  file: File | null;
  onProgress?: (s: UploadState | null) => void;
  signal?: AbortSignal;
};
type TestShellProps = DeferredUploadFormShellProps<TestVariables>;

const spec: MediaOriginSpec = {
  kind: 'image',
  accept: { mimes: ['image/jpeg'], kinds: ['image'] },
  maxBytes: 10 * 1024 * 1024,
};

function makeMutation(opts?: {
  mutateAsync?: TestShellProps['mutation']['mutateAsync'];
  isPending?: boolean;
}): TestShellProps['mutation'] {
  return {
    mutateAsync:
      opts?.mutateAsync ??
      vi.fn<TestShellProps['mutation']['mutateAsync']>().mockResolvedValue({ ok: true }),
    isPending: opts?.isPending ?? false,
  };
}

function renderShellWithRef(props?: Partial<TestShellProps>) {
  const mutation = props?.mutation ?? makeMutation();
  const buildVariables =
    props?.buildVariables ??
    vi.fn<TestShellProps['buildVariables']>((file, onProgress, signal) => ({
      file,
      onProgress,
      signal,
    }));
  const ref = createRef<DeferredUploadFormShellHandle>();
  const result = render(
    <DeferredUploadFormShell
      spec={spec}
      mutation={mutation}
      buildVariables={buildVariables}
      ref={ref}
      {...props}
    />,
  );
  return { ...result, ref };
}

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
    const mutateAsync = vi
      .fn<TestShellProps['mutation']['mutateAsync']>()
      .mockResolvedValue({ ok: true });
    const mutation = makeMutation({ mutateAsync });
    const buildVariables = vi.fn<TestShellProps['buildVariables']>((file, onProgress, signal) => ({
      kind: 'file',
      file,
      onProgress,
      signal,
    }));
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

  it('threads the MediaInput claim into buildVariables (4th arg) and clears it with the file', async () => {
    const user = userEvent.setup();
    const mutateAsync = vi
      .fn<TestShellProps['mutation']['mutateAsync']>()
      .mockResolvedValue({ ok: true });
    const mutation = makeMutation({ mutateAsync });
    const buildVariables = vi.fn<TestShellProps['buildVariables']>(
      (file, onProgress, signal, claim) => ({
        file,
        onProgress,
        signal,
        claim,
      }),
    );
    const { ref } = renderShellWithRef({ mutation, buildVariables });

    await user.click(screen.getByTestId('select-file-btn'));
    ref.current?.submit();

    await waitFor(() => expect(mutateAsync).toHaveBeenCalledOnce());
    expect(buildVariables.mock.calls[0][3]).toEqual({ kind: 'image', source: 'file-picker' });

    ref.current?.submit();
    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(2));
    expect(buildVariables.mock.calls[1][0]).toBeNull();
    expect(buildVariables.mock.calls[1][3]).toBeUndefined();
  });

  it('imperative submit with no file selected still calls mutateAsync', async () => {
    const mutateAsync = vi
      .fn<TestShellProps['mutation']['mutateAsync']>()
      .mockResolvedValue({ ok: true });
    const mutation = makeMutation({ mutateAsync });
    const buildVariables = vi.fn<TestShellProps['buildVariables']>((file, onProgress, signal) => ({
      kind: 'no-file',
      file,
      onProgress,
      signal,
    }));
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
      () =>
        new Promise<{ ok: true }>((res) => {
          resolveMutation = () => res({ ok: true });
        }),
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
    const mutateAsync = vi
      .fn<TestShellProps['mutation']['mutateAsync']>()
      .mockResolvedValue({ ok: true });
    const mutation = makeMutation({ mutateAsync });
    const { container, ref } = renderShellWithRef({ mutation });

    ref.current?.submit();
    await waitFor(() => expect(mutateAsync).toHaveBeenCalledOnce());

    const fileArea = container.querySelector('[aria-live="polite"]');
    expect(document.activeElement).not.toBe(fileArea);
  });

  it('mutation.isPending blocks re-entry into submit', async () => {
    const mutateAsync = vi
      .fn<TestShellProps['mutation']['mutateAsync']>()
      .mockResolvedValue({ ok: true });
    const mutation = makeMutation({ mutateAsync, isPending: true });
    const { ref } = renderShellWithRef({ mutation });

    ref.current?.submit();

    expect(mutateAsync).not.toHaveBeenCalled();
  });

  it('onSuccess fires after mutation.mutateAsync resolves', async () => {
    const onSuccess = vi.fn();
    const mutateAsync = vi
      .fn<TestShellProps['mutation']['mutateAsync']>()
      .mockResolvedValue({ ok: true });
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
    const mutateAsync = vi
      .fn<TestShellProps['mutation']['mutateAsync']>()
      .mockResolvedValue({ ok: true });
    const { ref } = renderShellWithRef({ mutation: makeMutation({ mutateAsync }) });

    await user.click(screen.getByTestId('select-file-btn'));
    ref.current?.submit();

    await waitFor(() => expect(mutateAsync).toHaveBeenCalledOnce());
    expect(screen.queryByTestId('upload-state-phase')).toBeNull();
  });

  it('onFileChange fires on select, on clear, and on post-success reset', async () => {
    const user = userEvent.setup();
    const onFileChange = vi.fn();
    const mutateAsync = vi
      .fn<TestShellProps['mutation']['mutateAsync']>()
      .mockResolvedValue({ ok: true });
    const { ref } = renderShellWithRef({ mutation: makeMutation({ mutateAsync }), onFileChange });

    await user.click(screen.getByTestId('select-file-btn'));
    expect(onFileChange).toHaveBeenLastCalledWith(expect.any(File));

    await user.click(screen.getByTestId('clear-file-btn'));
    expect(onFileChange).toHaveBeenLastCalledWith(null);

    await user.click(screen.getByTestId('select-file-btn'));
    ref.current?.submit();
    await waitFor(() => expect(mutateAsync).toHaveBeenCalledOnce());
    await waitFor(() => expect(onFileChange).toHaveBeenLastCalledWith(null));

    expect(onFileChange).toHaveBeenCalledTimes(4);
  });

  it('clicking cancel aborts the in-flight signal, swallows AbortError, and resets selectedFile', async () => {
    const user = userEvent.setup();
    const onError = vi.fn();
    const onFileChange = vi.fn();

    let capturedSignal: AbortSignal | undefined;
    const mutateAsync = vi.fn((vars: TestVariables) => {
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

    await user.click(screen.getByTestId('select-file-btn'));
    expect(onFileChange).toHaveBeenLastCalledWith(expect.any(File));

    ref.current?.submit();
    await waitFor(() => expect(mutateAsync).toHaveBeenCalledOnce());
    expect(capturedSignal).toBeInstanceOf(AbortSignal);

    await user.click(screen.getByTestId('cancel-upload-btn'));

    await waitFor(() => {
      expect(onFileChange).toHaveBeenLastCalledWith(null);
    });
    expect(onError).not.toHaveBeenCalled();
  });
});
