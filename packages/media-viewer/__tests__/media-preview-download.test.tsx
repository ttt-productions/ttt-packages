import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MediaPreview } from '../src/react/media-viewer.js';

describe('MediaPreview with a download the app owns', () => {
  it('draws the pending state while the download is out', () => {
    const { container } = render(<MediaPreview type="image" download={{ status: 'pending' }} />);

    expect(container.querySelector('img')).toBeNull();
    expect(screen.queryByText('Media unavailable.')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('draws the unavailable screen with no Retry for a missing or refused file', () => {
    const { container } = render(
      <MediaPreview type="image" download={{ status: 'unavailable' }} />,
    );

    expect(container.querySelector('.mv-recovery-hard')).toBeInTheDocument();
    expect(screen.getByText('Media unavailable.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument();
  });

  it('draws the max-wait screen for a failed download, whose Retry runs the download’s retry', () => {
    const retry = vi.fn();
    const { container } = render(
      <MediaPreview type="image" download={{ status: 'failed', retry, retrying: false }} />,
    );

    expect(container.querySelector('.mv-recovery-max-wait')).toBeInTheDocument();
    expect(screen.getByText('This media is taking longer than expected.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it('keeps the failure on screen with its Retry pending while the retry runs', () => {
    const retry = vi.fn();
    render(<MediaPreview type="image" download={{ status: 'failed', retry, retrying: true }} />);

    expect(screen.getByText('This media is taking longer than expected.')).toBeInTheDocument();
    const button = screen.getByRole('button', { name: /Retry/ });
    expect(button).toHaveAttribute('aria-busy', 'true');
    fireEvent.click(button);
    expect(retry).not.toHaveBeenCalled();
  });

  it('draws the placeholder in place of either screen when one is given', () => {
    for (const download of [
      { status: 'unavailable' as const },
      { status: 'failed' as const, retry: () => {}, retrying: false },
    ]) {
      const { unmount } = render(
        <MediaPreview
          type="image"
          download={download}
          placeholder={<span data-testid="ph">initials</span>}
        />,
      );
      expect(screen.getByTestId('ph')).toBeInTheDocument();
      expect(screen.queryByText('Media unavailable.')).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument();
      unmount();
    }
  });
});
