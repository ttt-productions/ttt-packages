import React from 'react';
import { render, screen, act, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import type { MediaOriginSpec } from '@ttt-productions/media-schemas';
import { MediaInput } from '../src/react/components/media-input';
import { RecordDialog } from '../src/react/components/record-dialog';

vi.mock('@ttt-productions/media-viewer/react', async () =>
  import('../../media-viewer/src/react/index.js'),
);

// Fake MediaRecorder:
type MRCtor = new (stream: MediaStream, opts?: MediaRecorderOptions) => MediaRecorder;

function installMediaRecorderMock(opts?: {
  /** mimeType the fake recorder reports (default 'audio/webm'). */
  mimeType?: string;
  /** When provided, installed as the static MediaRecorder.isTypeSupported. */
  isTypeSupported?: (type: string) => boolean;
}) {
  const reportedMimeType = opts?.mimeType ?? 'audio/webm';
  const instances: any[] = [];
  // Function expression, not an arrow: the component does `new MediaRecorder(...)`
  // and Vitest 4 mock implementations are only constructible when the impl is.
  const ctor = vi.fn(function (stream: MediaStream, _opts?: any) {
    const inst: any = {
      state: 'inactive',
      mimeType: reportedMimeType,
      ondataavailable: null,
      onstop: null,
      start: vi.fn(function (this: any) { this.state = 'recording'; }),
      stop: vi.fn(function (this: any) {
        this.state = 'inactive';
        // Simulate a chunk, then fire onstop synchronously so the preview state flips before assertions
        act(() => {
          this.ondataavailable?.({ data: new Blob(['chunk'], { type: reportedMimeType }), size: 5 } as any);
          this.onstop?.();
        });
      }),
      stream,
    };
    instances.push(inst);
    return inst;
  });
  if (opts?.isTypeSupported) {
    (ctor as any).isTypeSupported = vi.fn(opts.isTypeSupported);
  }
  (globalThis as any).MediaRecorder = ctor as unknown as MRCtor;
  return { ctor, instances };
}

function installGetUserMediaMock() {
  // Stable track objects so teardown's getTracks() call and the test's call
  // both reference the same spies.
  const tracks = [{ stop: vi.fn() }, { stop: vi.fn() }];
  const stream = {
    getTracks: () => tracks,
  } as unknown as MediaStream;
  const gum = vi.fn().mockResolvedValue(stream);
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: { getUserMedia: gum },
  });
  return { gum, stream, tracks };
}

function installAudioContextMock() {
  const source = { connect: vi.fn(), disconnect: vi.fn() };
  const analyser = { fftSize: 0, frequencyBinCount: 128, getByteTimeDomainData: vi.fn() };
  const ctor = vi.fn(function () {
    return {
      state: 'running',
      close: vi.fn().mockResolvedValue(undefined),
      createMediaStreamSource: vi.fn().mockReturnValue(source),
      createAnalyser: vi.fn().mockReturnValue(analyser),
    };
  });
  (globalThis as any).AudioContext = ctor;
  return { ctor };
}

function installObjectUrlMock() {
  const create = vi.fn().mockReturnValue('blob:mock-url');
  const revoke = vi.fn();
  (globalThis as any).URL.createObjectURL = create;
  (globalThis as any).URL.revokeObjectURL = revoke;
  return { create, revoke };
}

describe('RecordDialog', () => {
  let onRecorded: Mock<(file: File, previewUrl: string) => void | Promise<void>>;
  let onOpenChange: Mock<(open: boolean) => void>;
  let gumMock: ReturnType<typeof installGetUserMediaMock>;
  let urlMock: ReturnType<typeof installObjectUrlMock>;

  beforeEach(() => {
    onRecorded = vi.fn();
    onOpenChange = vi.fn();
    installMediaRecorderMock();
    gumMock = installGetUserMediaMock();
    installAudioContextMock();
    urlMock = installObjectUrlMock();
    vi.stubGlobal('requestAnimationFrame', vi.fn().mockReturnValue(1));
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    // MediaInput's selected-file preview (react-intersection-observer) needs
    // an IntersectionObserver; jsdom has none.
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        root = null;
        rootMargin = '';
        thresholds = [];
        observe() {}
        unobserve() {}
        disconnect() {}
        takeRecords() { return []; }
      },
    );
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => ({
      clearRect: vi.fn(),
      fillRect: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      fillStyle: '',
      lineWidth: 1,
      strokeStyle: '',
    } as unknown as CanvasRenderingContext2D));
    // Stub play to avoid jsdom errors
    Object.defineProperty(HTMLMediaElement.prototype, 'play', {
      configurable: true,
      value: vi.fn().mockResolvedValue(undefined),
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  function renderDialog(overrides: Partial<React.ComponentProps<typeof RecordDialog>> = {}) {
    return render(
      <RecordDialog
        open
        onOpenChange={onOpenChange}
        initialKind="audio"
        canPhoto={false}
        canRecVideo={true}
        canRecAudio={true}
        maxRecordDurationSec={60}
        onRecorded={onRecorded}
        {...overrides}
      />
    );
  }

  it('does not emit onRecorded when recording stops (Save gate)', async () => {
    const user = userEvent.setup();
    const { baseElement } = renderDialog();
    await user.click(screen.getByRole('button', { name: /^start$/i }));
    // mr.start was called; now stop
    await user.click(screen.getByRole('button', { name: /^stop$/i }));
    // After stop, dialog transitions to preview state. onRecorded MUST NOT have fired.
    expect(onRecorded).not.toHaveBeenCalled();
    // Recorded audio previews use the one package-owned player, never native chrome.
    expect(baseElement.querySelector('[data-mv-player]')).toBeInTheDocument();
    expect(baseElement.querySelector('audio')).not.toHaveAttribute('controls');
  });

  it('emits onRecorded once when Save is clicked in preview', async () => {
    const user = userEvent.setup();
    renderDialog();
    await user.click(screen.getByRole('button', { name: /^start$/i }));
    await user.click(screen.getByRole('button', { name: /^stop$/i }));
    await user.click(screen.getByRole('button', { name: /^save$/i }));
    expect(onRecorded).toHaveBeenCalledTimes(1);
    const [file, url] = onRecorded.mock.calls[0];
    expect(file).toBeInstanceOf(File);
    expect(url).toBe('blob:mock-url');
  });

  it('revokes preview URL and returns to idle on Re-record', async () => {
    const user = userEvent.setup();
    renderDialog();
    await user.click(screen.getByRole('button', { name: /^start$/i }));
    await user.click(screen.getByRole('button', { name: /^stop$/i }));
    await user.click(screen.getByRole('button', { name: /re-?record/i }));
    expect(urlMock.revoke).toHaveBeenCalledWith('blob:mock-url');
    // Back in idle — Start button visible again
    expect(screen.getByRole('button', { name: /^start$/i })).toBeInTheDocument();
    expect(onRecorded).not.toHaveBeenCalled();
  });

  it('shows discard confirmation when closing from preview without saving', async () => {
    const user = userEvent.setup();
    renderDialog();
    await user.click(screen.getByRole('button', { name: /^start$/i }));
    await user.click(screen.getByRole('button', { name: /^stop$/i }));
    // DialogContent (shadcn) injects its own sr-only "Close" button, so there are
    // two matches; the footer's explicit Close button is first in DOM order.
    const [footerCloseBtn] = screen.getAllByRole('button', { name: /^close$/i });
    await user.click(footerCloseBtn);
    // AlertDialog should appear with a Discard option
    expect(screen.getByText(/discard recording/i)).toBeInTheDocument();
    expect(onRecorded).not.toHaveBeenCalled();
  });

  it('cleans up MediaStream tracks on unmount', async () => {
    const user = userEvent.setup();
    const { unmount } = renderDialog();
    await user.click(screen.getByRole('button', { name: /^start$/i }));
    unmount();
    const tracks = (gumMock.stream.getTracks as any)();
    tracks.forEach((t: any) => {
      expect(t.stop).toHaveBeenCalled();
    });
  });

  it('renders Photo button only when canPhoto + onRequestPhoto are provided', async () => {
    const onRequestPhoto = vi.fn();
    const { rerender } = renderDialog();
    // canPhoto=false by default in renderDialog — no photo button
    expect(screen.queryByRole('button', { name: /^photo$/i })).not.toBeInTheDocument();

    rerender(
      <RecordDialog
        open
        onOpenChange={onOpenChange}
        initialKind="audio"
        canPhoto={true}
        canRecVideo={true}
        canRecAudio={true}
        maxRecordDurationSec={60}
        onRecorded={onRecorded}
        onRequestPhoto={onRequestPhoto}
      />
    );
    const photoBtn = screen.getByRole('button', { name: /^photo$/i });
    expect(photoBtn).toBeInTheDocument();
    const user = userEvent.setup();
    await user.click(photoBtn);
    expect(onRequestPhoto).toHaveBeenCalledTimes(1);
    // And the dialog requested close (onOpenChange(false))
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  // --- Recorded-audio MIME normalization (regression: Chrome's
  // "audio/webm;codecs=opus" used to fail validation, fall back to the
  // .webm extension map, and emit video/webm for every audio recording). ---

  async function recordStopSave() {
    const user = userEvent.setup();
    renderDialog();
    await user.click(screen.getByRole('button', { name: /^start$/i }));
    await user.click(screen.getByRole('button', { name: /^stop$/i }));
    await user.click(screen.getByRole('button', { name: /^save$/i }));
    expect(onRecorded).toHaveBeenCalledTimes(1);
    return onRecorded.mock.calls[0][0];
  }

  it('requests an explicit supported container and normalizes a Chrome-style parameterized audio recording to audio/webm', async () => {
    const { ctor } = installMediaRecorderMock({
      mimeType: 'audio/webm;codecs=opus',
      isTypeSupported: (t) => t === 'audio/webm;codecs=opus',
    });
    const file = await recordStopSave();
    // The first supported candidate was requested explicitly.
    expect((ctor as any).isTypeSupported).toHaveBeenCalledWith('audio/webm;codecs=opus');
    expect(ctor).toHaveBeenCalledWith(expect.anything(), { mimeType: 'audio/webm;codecs=opus' });
    // Emitted File carries the parameter-less base type (storage rules
    // validate a parameter-less image|video|audio regex).
    expect(file.type).toBe('audio/webm');
    expect(file.name).toBe('recording.webm');
  });

  it('falls back to the no-argument constructor when isTypeSupported is unavailable (test environments)', async () => {
    const { ctor } = installMediaRecorderMock(); // no static isTypeSupported
    const file = await recordStopSave();
    expect(ctor.mock.calls[0][1]).toBeUndefined();
    expect(file.type).toBe('audio/webm');
  });

  it('a recorder that reports video/* for a chosen-audio recording still emits audio/* (chosen kind wins)', async () => {
    installMediaRecorderMock({ mimeType: 'video/webm' });
    const file = await recordStopSave();
    expect(file.type).toBe('audio/webm');
  });

  it('a recorder that reports video/mp4 for a chosen-audio recording emits audio/mp4 named recording.m4a', async () => {
    // Defensive edge: an audio-only stream (video:false) reported as the mp4
    // container. mp4 is not in the ambiguous-extension map, so naming the file
    // by its declared video/mp4 would re-derive video/mp4 from the .mp4 extension.
    // The recorder's authoritative audio kind names it .m4a → audio/mp4.
    installMediaRecorderMock({ mimeType: 'video/mp4' });
    const file = await recordStopSave();
    expect(file.type).toBe('audio/mp4');
    expect(file.name).toBe('recording.m4a');
  });

  it('a video/mp4-misreported audio recording reads "Audio selected" in MediaInput, never "Video selected"', async () => {
    installMediaRecorderMock({ mimeType: 'video/mp4' });
    const file = await recordStopSave();
    expect(file.type).toBe('audio/mp4');

    const spec: MediaOriginSpec = {
      kind: 'audio',
      accept: { kinds: ['audio'], mimes: ['audio/mp4'] },
    };
    render(
      <MediaInput spec={spec} selectedFile={file} onChange={vi.fn()} onClear={vi.fn()} />,
    );
    expect(screen.getByText('Audio selected')).toBeInTheDocument();
    expect(screen.queryByText('Video selected')).toBeNull();
  });

  it('a Safari-style audio/mp4 audio recording is preserved as audio/mp4 named recording.m4a', async () => {
    installMediaRecorderMock({
      mimeType: 'audio/mp4',
      isTypeSupported: (t) => t === 'audio/mp4',
    });
    const file = await recordStopSave();
    expect(file.type).toBe('audio/mp4');
    expect(file.name).toBe('recording.m4a');
  });

  it('a video recording reporting video/mp4 is preserved as video/mp4 named recording.mp4 (video kind)', async () => {
    installMediaRecorderMock({ mimeType: 'video/mp4' });
    const user = userEvent.setup();
    renderDialog({ initialKind: 'video' });
    await user.click(screen.getByRole('button', { name: /^start$/i }));
    await user.click(screen.getByRole('button', { name: /^stop$/i }));
    await user.click(screen.getByRole('button', { name: /^save$/i }));
    expect(onRecorded).toHaveBeenCalledTimes(1);
    const file = onRecorded.mock.calls[0][0];
    expect(file.type).toBe('video/mp4');
    expect(file.name).toBe('recording.mp4');
  });

  it('the saved recorded-audio File reads "Audio selected" in MediaInput', async () => {
    installMediaRecorderMock({
      mimeType: 'audio/webm;codecs=opus',
      isTypeSupported: (t) => t.startsWith('audio/webm'),
    });
    const file = await recordStopSave();
    expect(file.type.startsWith('audio/')).toBe(true);

    const spec: MediaOriginSpec = {
      kind: 'audio',
      accept: { kinds: ['audio'], mimes: ['audio/webm'] },
    };
    render(
      <MediaInput spec={spec} selectedFile={file} onChange={vi.fn()} onClear={vi.fn()} />,
    );
    expect(screen.getByText('Audio selected')).toBeInTheDocument();
    expect(screen.queryByText('Video selected')).toBeNull();
  });
});
