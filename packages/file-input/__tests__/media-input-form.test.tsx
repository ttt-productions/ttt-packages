import type * as React from 'react';
import { render, screen, cleanup, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, afterEach } from 'vitest';
import type { MediaOriginSpec } from '@ttt-productions/media-schemas';
import { MediaInput } from '../src/react/components/media-input';
import { FileInput } from '../src/react/components/file-input';

vi.mock('@ttt-productions/media-viewer/react', () => ({
  MediaPreview: () => <div data-testid="media-preview" />,
}));

const spec: MediaOriginSpec = {
  kind: 'image',
  accept: { mimes: ['image/jpeg', 'image/png'], kinds: ['image'] },
  maxBytes: 10 * 1024 * 1024,
};

afterEach(() => {
  cleanup();
});

function renderInsideForm(overrides: Partial<React.ComponentProps<typeof MediaInput>> = {}) {
  const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault());
  render(
    <form aria-label="Create" onSubmit={onSubmit}>
      <MediaInput spec={spec} onChange={vi.fn()} {...overrides} />
      <button type="submit">Save</button>
    </form>,
  );
  const form = screen.getByRole('form', { name: 'Create' });
  const mediaInputButtons = within(form)
    .getAllByRole('button')
    .filter((b) => b.textContent !== 'Save');
  return { onSubmit, form, mediaInputButtons };
}

describe('MediaInput inside a form', () => {
  it('never submits the form from its trigger, Info, or Clear buttons', async () => {
    const withSelection = {
      selectedFile: new File(['x'], 'photo.jpg', { type: 'image/jpeg' }),
      onClear: vi.fn(),
    };
    // Trigger, Info, and Clear.
    const count = renderInsideForm(withSelection).mediaInputButtons.length;
    expect(count).toBeGreaterThanOrEqual(3);
    cleanup();

    // Each button in a fresh render, so a menu one of them opens cannot mask another.
    for (let index = 0; index < count; index++) {
      const user = userEvent.setup();
      const { onSubmit, mediaInputButtons } = renderInsideForm(withSelection);
      const button = mediaInputButtons[index];
      expect(button).toHaveAttribute('type', 'button');
      await user.click(button);
      expect(onSubmit).not.toHaveBeenCalled();
      cleanup();
    }
  });

  it('never submits the form when its buttons are activated from the keyboard', async () => {
    const user = userEvent.setup();
    const { onSubmit, mediaInputButtons } = renderInsideForm({
      selectedFile: new File(['x'], 'photo.jpg', { type: 'image/jpeg' }),
      onClear: vi.fn(),
    });

    for (const button of mediaInputButtons) {
      button.focus();
      await user.keyboard('{Enter}');
    }

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('never submits the form from its cancel-upload button', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    const { onSubmit } = renderInsideForm({
      isLoading: true,
      uploadState: { phase: 'uploading', percent: 40 },
      onCancel,
    });

    await user.click(screen.getByLabelText('Cancel upload'));

    expect(onCancel).toHaveBeenCalledOnce();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('leaves the surrounding form submit button working', async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderInsideForm();

    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(onSubmit).toHaveBeenCalledOnce();
  });
});

describe('the clear button', () => {
  const file = () => new File(['x'], 'photo.jpg', { type: 'image/jpeg' });

  it('is named "Clear selected file" by default and clears when pressed', async () => {
    const user = userEvent.setup();
    const onClear = vi.fn();
    render(<MediaInput spec={spec} onChange={vi.fn()} selectedFile={file()} onClear={onClear} />);

    await user.click(screen.getByRole('button', { name: 'Clear selected file' }));

    expect(onClear).toHaveBeenCalledOnce();
  });

  it('takes the consumer label when one is supplied', () => {
    render(<MediaInput spec={spec} onChange={vi.fn()} selectedFile={file()} onClear={vi.fn()} clearLabel="Remove photo" />);
    expect(screen.getByRole('button', { name: 'Remove photo' })).toBeInTheDocument();
  });

  it('is named in the legacy FileInput too', () => {
    render(
      <FileInput acceptTypes={['image']} maxSizeMB={{ image: 10 }} selectedFile={file()} onChange={vi.fn()} />,
    );
    expect(screen.getByRole('button', { name: 'Clear selected file' })).toBeInTheDocument();
  });
});
