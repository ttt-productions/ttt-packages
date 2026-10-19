import { render, screen, cleanup, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PhotoCaptureModal } from '../src/react/components/photo-capture-modal.js';

function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

function fakeStream() {
  const tracks = [{ stop: vi.fn() }];
  return { stream: { getTracks: () => tracks } as unknown as MediaStream, track: tracks[0] };
}

// Each getUserMedia call gets its own deferred acquisition, resolved by the test.
let acquisitions: Array<ReturnType<typeof deferred<MediaStream>>>;

beforeEach(() => {
  acquisitions = [];
  Object.defineProperty(HTMLMediaElement.prototype, 'play', {
    configurable: true,
    value: vi.fn().mockResolvedValue(undefined),
  });
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: {
      getUserMedia: vi.fn(() => {
        const d = deferred<MediaStream>();
        acquisitions.push(d);
        return d.promise;
      }),
    },
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('PhotoCaptureModal — a camera that starts after the dialog let it go', () => {
  it('stops a camera that finishes starting after Close, and never shows it ready', async () => {
    const { rerender } = render(<PhotoCaptureModal open onCapture={vi.fn()} onClose={vi.fn()} />);
    fireEvent.click(screen.getAllByRole('button', { name: 'Close' })[0]);
    rerender(<PhotoCaptureModal open={false} onCapture={vi.fn()} onClose={vi.fn()} />);

    const late = fakeStream();
    await act(async () => {
      acquisitions[0].resolve(late.stream);
    });
    expect(late.track.stop).toHaveBeenCalled();
  });

  it('stops a camera that finishes starting while the dialog is still open but was closed by its own Close', async () => {
    render(<PhotoCaptureModal open onCapture={vi.fn()} onClose={vi.fn()} />);
    fireEvent.click(screen.getAllByRole('button', { name: 'Close' })[0]);

    const late = fakeStream();
    await act(async () => {
      acquisitions[0].resolve(late.stream);
    });
    expect(late.track.stop).toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Capture' })).toBeDisabled();
  });

  it('stops a camera that finishes starting after the dialog unmounted', async () => {
    const { unmount } = render(<PhotoCaptureModal open onCapture={vi.fn()} onClose={vi.fn()} />);
    unmount();

    const late = fakeStream();
    await act(async () => {
      acquisitions[0].resolve(late.stream);
    });
    expect(late.track.stop).toHaveBeenCalled();
  });

  it('stops the Flip camera when the dialog unmounts before it starts', async () => {
    const { unmount } = render(<PhotoCaptureModal open onCapture={vi.fn()} onClose={vi.fn()} />);
    const first = fakeStream();
    await act(async () => {
      acquisitions[0].resolve(first.stream);
    });
    expect(screen.getByRole('button', { name: 'Capture' })).toBeEnabled();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Flip' }));
    });
    expect(first.track.stop).toHaveBeenCalled();
    expect(acquisitions).toHaveLength(2);
    unmount();

    const flipped = fakeStream();
    await act(async () => {
      acquisitions[1].resolve(flipped.stream);
    });
    expect(flipped.track.stop).toHaveBeenCalled();
  });

  it('stops a superseded camera and keeps the newer one attached and ready', async () => {
    const { rerender } = render(<PhotoCaptureModal open onCapture={vi.fn()} onClose={vi.fn()} />);
    rerender(<PhotoCaptureModal open={false} onCapture={vi.fn()} onClose={vi.fn()} />);
    rerender(<PhotoCaptureModal open onCapture={vi.fn()} onClose={vi.fn()} />);
    expect(acquisitions).toHaveLength(2);

    const newer = fakeStream();
    await act(async () => {
      acquisitions[1].resolve(newer.stream);
    });
    expect(screen.getByRole('button', { name: 'Capture' })).toBeEnabled();

    const stale = fakeStream();
    await act(async () => {
      acquisitions[0].resolve(stale.stream);
    });
    expect(stale.track.stop).toHaveBeenCalled();
    expect(newer.track.stop).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Capture' })).toBeEnabled();
  });
});
