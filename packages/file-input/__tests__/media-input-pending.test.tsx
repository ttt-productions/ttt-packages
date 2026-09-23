import { render, screen, cleanup, fireEvent, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { MediaOriginSpec } from '@ttt-productions/media-schemas';
import { MediaInput } from '../src/react/components/media-input';
import { ImageCropperModal } from '../src/react/components/image-cropper-modal';
import { PhotoCaptureModal } from '../src/react/components/photo-capture-modal';
import { getCroppedImg } from '../src/lib/image-utils.js';
import { DEFAULT_PROGRESS_BAR_MIN_BYTES } from '../src/index.js';

vi.mock('@ttt-productions/media-viewer/react', async () =>
  import('../../media-viewer/src/react/index.js'),
);

// A controllable meta read: while `metaGate` is set, validation waits on it.
let metaGate: Promise<void> | null = null;
vi.mock('../src/lib/read-media-meta.js', () => ({
  readMediaMeta: async (file: File) => {
    if (metaGate) await metaGate;
    return { kind: 'audio', mime: file.type, sizeBytes: file.size };
  },
}));

vi.mock('../src/lib/image-utils.js', () => ({ getCroppedImg: vi.fn() }));

// jsdom cannot run the real cropper; report one crop area once, like the library does.
vi.mock('react-easy-crop', async () => {
  const ReactMod = await import('react');
  return {
    default: function MockCropper(props: { onCropComplete: (a: unknown, p: unknown) => void }) {
      const reported = ReactMod.useRef(false);
      ReactMod.useEffect(() => {
        if (reported.current) return;
        reported.current = true;
        props.onCropComplete({}, { x: 0, y: 0, width: 10, height: 10 });
      }, [props]);
      return null;
    },
  };
});

function deferred<T = void>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

const AUDIO_SPEC: MediaOriginSpec = {
  kind: 'audio',
  accept: { kinds: ['audio'] },
  client: { allowPick: true, allowCapturePhoto: false, allowRecordVideo: false, allowRecordAudio: false },
};

beforeEach(() => {
  metaGate = null;
  (globalThis as any).URL.createObjectURL = vi.fn().mockReturnValue('blob:mock-url');
  (globalThis as any).URL.revokeObjectURL = vi.fn();
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      root = null;
      rootMargin = '';
      thresholds = [];
      observe() {}
      unobserve() {}
      disconnect() {}
      takeRecords() {
        return [];
      }
    },
  );
  // The cropper's zoom Slider (Radix) measures itself; jsdom has no ResizeObserver.
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('MediaInput — validation window and progress', () => {
  it('the trigger is pending while a picked file is validated, then settles', async () => {
    const gate = deferred();
    metaGate = gate.promise;
    const onChange = vi.fn();
    render(<MediaInput spec={AUDIO_SPEC} onChange={onChange} />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File(['x'], 'take.mp3', { type: 'audio/mpeg' })] } });

    const trigger = await screen.findByRole('button', { name: 'Choose file' });
    await waitFor(() => expect(trigger).toHaveAttribute('aria-busy', 'true'));
    expect(trigger).toBeDisabled();
    expect(input).toBeDisabled();

    await act(async () => {
      gate.resolve();
    });
    await waitFor(() => expect(onChange).toHaveBeenCalled());
    expect(screen.getByRole('button', { name: 'Choose file' })).not.toHaveAttribute('aria-busy');
  });

  it('shows the real percent bar for a large emitted file even when the consumer passes selectedFile={null}', async () => {
    const onChange = vi.fn();
    const { rerender } = render(<MediaInput spec={AUDIO_SPEC} onChange={onChange} selectedFile={null} />);
    const big = new File([new Uint8Array(DEFAULT_PROGRESS_BAR_MIN_BYTES + 1)], 'long.mp3', { type: 'audio/mpeg' });
    fireEvent.change(document.querySelector('input[type="file"]') as HTMLInputElement, { target: { files: [big] } });
    await waitFor(() => expect(onChange).toHaveBeenCalled());

    rerender(
      <MediaInput
        spec={AUDIO_SPEC}
        onChange={onChange}
        selectedFile={null}
        isLoading
        uploadState={{ phase: 'uploading', percent: 40 }}
      />,
    );
    expect(screen.getByText('Uploading 40%...')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('keeps the indeterminate row (no percent bar) for a small emitted file', async () => {
    const onChange = vi.fn();
    const { rerender } = render(<MediaInput spec={AUDIO_SPEC} onChange={onChange} selectedFile={null} />);
    fireEvent.change(document.querySelector('input[type="file"]') as HTMLInputElement, {
      target: { files: [new File(['x'], 'tiny.mp3', { type: 'audio/mpeg' })] },
    });
    await waitFor(() => expect(onChange).toHaveBeenCalled());

    rerender(
      <MediaInput
        spec={AUDIO_SPEC}
        onChange={onChange}
        selectedFile={null}
        isLoading
        uploadState={{ phase: 'uploading', percent: 40 }}
      />,
    );
    expect(screen.getByText('Uploading...')).toBeInTheDocument();
    expect(screen.queryByRole('progressbar')).toBeNull();
  });
});

describe('ImageCropperModal — Confirm', () => {
  it('is pending while the crop renders and ignores a second click, so the crop is emitted once', async () => {
    const crop = deferred<Blob>();
    vi.mocked(getCroppedImg).mockImplementation(() => crop.promise);
    const onCropComplete = vi.fn();
    const onClose = vi.fn();
    render(
      <ImageCropperModal
        isOpen
        onClose={onClose}
        imageSrc="blob:source"
        aspectRatio={1}
        shape="rect"
        outputWidth={10}
        outputHeight={10}
        onCropComplete={onCropComplete}
      />,
    );

    const confirm = screen.getByRole('button', { name: 'Confirm' });
    await act(async () => {
      fireEvent.click(confirm);
    });
    expect(confirm).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    fireEvent.click(confirm);
    expect(getCroppedImg).toHaveBeenCalledTimes(1);

    const blob = new Blob(['img'], { type: 'image/jpeg' });
    await act(async () => {
      crop.resolve(blob);
    });
    expect(onCropComplete).toHaveBeenCalledTimes(1);
    expect(onCropComplete).toHaveBeenCalledWith(blob);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('PhotoCaptureModal — acquisition and Capture', () => {
  beforeEach(() => {
    Object.defineProperty(HTMLMediaElement.prototype, 'play', {
      configurable: true,
      value: vi.fn().mockResolvedValue(undefined),
    });
  });

  it('shows a loader while the camera starts, then captures once even on a double tap', async () => {
    const gum = deferred<MediaStream>();
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: vi.fn(() => gum.promise) },
    });
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
      () => ({ drawImage: vi.fn() }) as unknown as CanvasRenderingContext2D,
    );
    const toBlobCallbacks: Array<(b: Blob | null) => void> = [];
    Object.defineProperty(HTMLCanvasElement.prototype, 'toBlob', {
      configurable: true,
      value: vi.fn(function (cb: (b: Blob | null) => void) {
        toBlobCallbacks.push(cb);
      }),
    });

    const onCapture = vi.fn();
    render(<PhotoCaptureModal open onCapture={onCapture} onClose={vi.fn()} />);

    expect(screen.getByRole('status')).toHaveTextContent(/starting camera/i);
    expect(screen.getByRole('button', { name: 'Capture' })).toBeDisabled();

    const tracks = [{ stop: vi.fn() }];
    await act(async () => {
      gum.resolve({ getTracks: () => tracks } as unknown as MediaStream);
    });
    expect(screen.queryByRole('status')).toBeNull();

    const capture = screen.getByRole('button', { name: 'Capture' });
    await act(async () => {
      fireEvent.click(capture);
    });
    expect(capture).toHaveAttribute('aria-busy', 'true');
    fireEvent.click(capture);
    expect(toBlobCallbacks).toHaveLength(1);

    await act(async () => {
      toBlobCallbacks[0](new Blob(['jpg'], { type: 'image/jpeg' }));
    });
    expect(onCapture).toHaveBeenCalledTimes(1);
    expect(onCapture.mock.calls[0][0]).toBeInstanceOf(File);
  });
});
