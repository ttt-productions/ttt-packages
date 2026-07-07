import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, act, screen, fireEvent } from '@testing-library/react';

type UploadArgs = Record<string, unknown> & { signal?: AbortSignal };
type UploadCall = { signal: AbortSignal | undefined; resolve: () => void; reject: (err: unknown) => void };
const guardedUploadCalls: UploadCall[] = [];

const guardedUploadMock = vi.fn((args: UploadArgs) =>
  new Promise<void>((resolve, reject) => {
    guardedUploadCalls.push({ signal: args.signal, resolve, reject });
    args.signal?.addEventListener('abort', () => {
      const err = new Error('aborted');
      err.name = 'AbortError';
      reject(err);
    });
  }),
);

vi.mock('@ttt-productions/upload-ui/react/upload', () => ({
  useGuardedUpload: () => guardedUploadMock,
}));

vi.mock('@ttt-productions/file-input/react', () => ({
  MediaInput: (props: {
    onChange?: (p: { file: File; error: null }) => void;
    onCancel?: () => void;
    isLoading?: boolean;
  }) => (
    <div>
      <button
        data-testid="media-input-select"
        onClick={() =>
          props.onChange?.({
            file: new File(['hello'], 'hello.png', { type: 'image/png' }),
            error: null,
          })
        }
      >
        select
      </button>
      <button
        data-testid="media-input-cancel"
        onClick={() => props.onCancel?.()}
        disabled={!props.isLoading}
      >
        cancel
      </button>
    </div>
  ),
}));

vi.mock('@ttt-productions/file-input', () => ({
  ensureFileWithContentType: (f: File) => f,
}));

vi.mock('../src/mentions/use-mention-autocomplete.js', () => ({
  useMentionAutocomplete: () => ({
    state: { open: false },
    getValueWithTokens: () => '',
    close: vi.fn(),
    insertMention: vi.fn(),
    handleKeyDown: () => false,
  }),
}));

vi.mock('../src/mentions/MentionAutocomplete.js', () => ({
  MentionAutocomplete: () => null,
}));

import { Composer } from '../src/ui/Composer.js';

function makeAttachmentConfig() {
  return {
    storage: {} as never,
    userId: 'user1',
    uploadAdapter: {
      buildUploadPath: ({ userId, attachmentId }: { userId: string; attachmentId: string }) =>
        `uploads/chat-attachment/${userId}/${attachmentId}`,
    },
    attachmentSpec: {} as never,
  } as never;
}

describe('Composer abort wiring', () => {
  beforeEach(() => {
    guardedUploadCalls.length = 0;
    guardedUploadMock.mockClear();
  });

  it('passes AbortSignal to guardedUpload and swallows AbortError on cancel', async () => {
    const sendAttachment = vi.fn().mockResolvedValue(undefined);
    const onSend = vi.fn().mockResolvedValue(undefined);

    render(
      <Composer
        onSend={onSend}
        attachmentConfig={makeAttachmentConfig()}
        sendAttachment={sendAttachment}
      />,
    );

    // Select a file — drives handleFileSelected via the MediaInput mock's onChange
    fireEvent.click(screen.getByTestId('media-input-select'));
    await act(async () => { });

    // Send button is enabled once pendingFile is set
    const sendBtn = screen.getByRole('button', { name: 'Send' });
    expect(sendBtn).not.toBeDisabled();

    // Click Send — send() creates an AbortController, calls guardedUpload, and suspends
    fireEvent.click(sendBtn);
    await act(async () => { });

    // guardedUpload received an AbortSignal that is not yet aborted
    expect(guardedUploadCalls).toHaveLength(1);
    expect(guardedUploadCalls[0].signal).toBeInstanceOf(AbortSignal);
    expect(guardedUploadCalls[0].signal?.aborted).toBe(false);

    // Cancel button is enabled while isSending=true
    const cancelBtn = screen.getByTestId('media-input-cancel');
    expect(cancelBtn).not.toBeDisabled();

    // Click cancel — handleCancelUpload aborts the controller → guardedUpload rejects with AbortError
    fireEvent.click(cancelBtn);
    await act(async () => { });

    // Signal is now aborted
    expect(guardedUploadCalls[0].signal?.aborted).toBe(true);

    // AbortError was swallowed — sendAttachment was never called
    expect(sendAttachment).not.toHaveBeenCalled();

    // Component recovered: isSending=false, pendingFile=null → send button disabled (no text, no file)
    expect(sendBtn).toBeDisabled();
  });
});

describe('Composer send failure (C-B8)', () => {
  it('keeps the text and shows an error when send fails — no clear, no re-throw', async () => {
    const onSend = vi.fn().mockRejectedValue(new Error('chat-send-failed'));
    render(<Composer onSend={onSend} />);

    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: 'keep me' } });

    const sendBtn = screen.getByRole('button', { name: 'Send' });
    expect(sendBtn).not.toBeDisabled();

    fireEvent.click(sendBtn);
    await act(async () => {});

    expect(onSend).toHaveBeenCalled();
    // Text preserved (setText('') only runs on the success path), error surfaced.
    expect(textarea.value).toBe('keep me');
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });
});

describe('Composer navigation-guard registration (in-flight send)', () => {
  it('registers with the LocalUploadGuard while a send is in flight and unregisters when it settles', async () => {
    const { LocalUploadGuardProvider, useLocalUploadGuard } = await import(
      '@ttt-productions/upload-ui/react/guard'
    );
    function GuardCountProbe() {
      const { activeUploadCount } = useLocalUploadGuard();
      return <div data-testid="guard-count">{activeUploadCount}</div>;
    }

    let resolveSend: () => void = () => {};
    const sendAttachment = vi.fn(
      () => new Promise<void>((res) => { resolveSend = res; }),
    );

    render(
      <LocalUploadGuardProvider>
        <GuardCountProbe />
        <Composer
          onSend={vi.fn().mockResolvedValue(undefined)}
          attachmentConfig={makeAttachmentConfig()}
          sendAttachment={sendAttachment}
        />
      </LocalUploadGuardProvider>,
    );

    fireEvent.click(screen.getByTestId('media-input-select'));
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    // Registered for the whole in-flight window: upload phase…
    expect(screen.getByTestId('guard-count').textContent).toBe('1');
    await act(async () => { guardedUploadCalls.at(-1)?.resolve(); });
    // …and the backend-send phase (this is what a navigation would abort).
    expect(screen.getByTestId('guard-count').textContent).toBe('1');

    await act(async () => { resolveSend(); });
    expect(screen.getByTestId('guard-count').textContent).toBe('0');
  });

  it('degrades gracefully without a LocalUploadGuardProvider (optional accessor)', async () => {
    const onSend = vi.fn().mockResolvedValue(undefined);
    render(<Composer onSend={onSend} />);
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: 'no provider' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    await act(async () => {});
    expect(onSend).toHaveBeenCalled();
  });
});
