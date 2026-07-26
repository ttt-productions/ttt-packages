import { describe, it, expect, vi } from 'vitest';
import { render, act, screen, fireEvent } from '@testing-library/react';

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

describe('Composer is text-only (Conversation Files replaced chat attachments)', () => {
  it('renders no attach control and no file picker', () => {
    render(<Composer onSend={vi.fn().mockResolvedValue(undefined)} />);
    expect(screen.queryByRole('button', { name: /attach/i })).toBeNull();
    expect(document.querySelector('input[type="file"]')).toBeNull();
    // Exactly one action button: Send.
    expect(screen.getAllByRole('button').map((b) => b.textContent)).toEqual(['Send']);
  });

  it('keeps Send disabled with no text (there is no file to send instead)', () => {
    render(<Composer onSend={vi.fn().mockResolvedValue(undefined)} />);
    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled();
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
    const onSend = vi.fn(() => new Promise<void>((res) => { resolveSend = res; }));

    render(
      <LocalUploadGuardProvider>
        <GuardCountProbe />
        <Composer onSend={onSend} />
      </LocalUploadGuardProvider>,
    );

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'in flight' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    // Registered for the whole in-flight window — this is what a navigation would abort.
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
