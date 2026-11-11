import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { CopyButton } from '../src/react/components/copy-button.js';
import { Toaster } from '../src/react/components/toaster.js';

const VALUE = 'https://example.test/s/abc123';
const copiedToast = { title: 'Link copied', variant: 'success' as const };
const failedToast = { title: 'Could not copy the link', variant: 'destructive' as const };

function stubClipboard(clipboard: { writeText: (value: string) => Promise<void> } | undefined) {
  Object.defineProperty(navigator, 'clipboard', { value: clipboard, configurable: true });
}

function renderButton(props: Partial<React.ComponentProps<typeof CopyButton>> = {}) {
  return render(
    <>
      <CopyButton
        value={VALUE}
        title="invite link"
        copiedToast={copiedToast}
        failedToast={failedToast}
        {...props}
      />
      <Toaster />
    </>,
  );
}

async function press(name = 'Copy invite link') {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name }));
  });
}

const icon = () =>
  screen.getByRole('button', { name: 'Copy invite link' }).querySelector('svg')?.classList;

afterEach(() => {
  Reflect.deleteProperty(navigator, 'clipboard');
  vi.useRealTimers();
});

describe('CopyButton', () => {
  it('is named "Copy <title>" for a screen reader, never a bare "Copy"', () => {
    renderButton();
    expect(screen.getByRole('button', { name: 'Copy invite link' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Copy' })).toBeNull();
  });

  it('never submits a form it sits in', async () => {
    const onSubmit = vi.fn((e: React.FormEvent) => e.preventDefault());
    stubClipboard({ writeText: () => Promise.resolve() });
    render(
      <form onSubmit={onSubmit}>
        <CopyButton
          value={VALUE}
          title="invite link"
          copiedToast={copiedToast}
          failedToast={failedToast}
        />
      </form>,
    );
    await press();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("writes the value to the clipboard and always shows the app's copied wording, never its failure wording", async () => {
    const writeText = vi.fn((_value: string) => Promise.resolve());
    stubClipboard({ writeText });
    renderButton({
      copiedToast: { title: 'Invite link copied', variant: 'success' },
      failedToast: { title: 'Invite link not copied', variant: 'destructive' },
    });
    await press();
    expect(writeText).toHaveBeenCalledWith(VALUE);
    expect(await screen.findByText('Invite link copied')).toBeInTheDocument();
    expect(screen.queryByText('Invite link not copied')).toBeNull();
  });

  it('swaps its icon to a check while the copy is fresh, then back to the copy icon', async () => {
    vi.useFakeTimers();
    stubClipboard({ writeText: () => Promise.resolve() });
    renderButton();
    expect(icon()).toContain('lucide-copy');
    await press();
    expect(icon()).toContain('lucide-check');
    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(icon()).toContain('lucide-copy');
  });

  it("a refused write shows the app's failure wording, never its success wording, and no check", async () => {
    stubClipboard({ writeText: () => Promise.reject(new Error('denied')) });
    renderButton({
      copiedToast: { title: 'Refused copy succeeded', variant: 'success' },
      failedToast: { title: 'Refused copy failed', variant: 'destructive' },
    });
    await press();
    expect(await screen.findByText('Refused copy failed')).toBeInTheDocument();
    expect(screen.queryByText('Refused copy succeeded')).toBeNull();
    expect(icon()).toContain('lucide-copy');
  });

  it('a page with no clipboard at all fails the same visible way', async () => {
    stubClipboard(undefined);
    renderButton({ failedToast: { title: 'No clipboard here', variant: 'destructive' } });
    await press();
    expect(await screen.findByText('No clipboard here')).toBeInTheDocument();
  });

  it('is pending while the write is in flight and ignores a second press', async () => {
    let finish = () => {};
    const writeText = vi.fn(
      (_value: string) =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    stubClipboard({ writeText });
    renderButton();
    await press();
    const button = screen.getByRole('button', { name: 'Copy invite link' });
    expect(button).toHaveAttribute('aria-busy', 'true');
    await press();
    expect(writeText).toHaveBeenCalledTimes(1);
    await act(async () => {
      finish();
    });
    expect(button).not.toHaveAttribute('aria-busy');
  });
});
