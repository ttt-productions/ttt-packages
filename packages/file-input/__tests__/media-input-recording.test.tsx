import React from 'react';
import { render, screen, act, cleanup, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import type { MediaOriginSpec } from '@ttt-productions/media-schemas';
import { MediaInput } from '../src/react/components/media-input.js';
import { RecordDialog, autoStopDelayMs } from '../src/react/components/record-dialog.js';

type FakeRecorder = {
  state: RecordingState;
  mimeType: string;
  ondataavailable: ((event: { data: Blob; size: number }) => void) | null;
  onstop: (() => void) | null;
  start: Mock<(this: FakeRecorder) => void>;
  stop: Mock<(this: FakeRecorder) => void>;
  stream: MediaStream;
};

function installMediaRecorderMock(opts?: {
  mimeType?: string;
  isTypeSupported?: (type: string) => boolean;
}) {
  const reportedMimeType = opts?.mimeType ?? 'audio/webm';
  const instances: FakeRecorder[] = [];
  // A function expression, not an arrow: a Vitest mock is constructible only when its impl is.
  const ctor = vi.fn(function (stream: MediaStream, _opts?: MediaRecorderOptions) {
    const inst: FakeRecorder = {
      state: 'inactive',
      mimeType: reportedMimeType,
      ondataavailable: null,
      onstop: null,
      start: vi.fn(function (this: FakeRecorder) {
        this.state = 'recording';
      }),
      stop: vi.fn(function (this: FakeRecorder) {
        this.state = 'inactive';
        act(() => {
          this.ondataavailable?.({
            data: new Blob(['chunk'], { type: reportedMimeType }),
            size: 5,
          });
          this.onstop?.();
        });
      }),
      stream,
    };
    instances.push(inst);
    return inst;
  });
  const isTypeSupported = opts?.isTypeSupported ? vi.fn(opts.isTypeSupported) : undefined;
  if (isTypeSupported) Object.assign(ctor, { isTypeSupported });
  Object.assign(globalThis, { MediaRecorder: ctor });
  return { ctor, instances, isTypeSupported };
}

function installGetUserMediaMock() {
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
  Object.assign(globalThis, { AudioContext: ctor });
  return { ctor };
}

function installObjectUrlMock() {
  const create = vi.fn().mockReturnValue('blob:mock-url');
  const revoke = vi.fn();
  URL.createObjectURL = create;
  URL.revokeObjectURL = revoke;
  return { create, revoke };
}

describe('RecordDialog', () => {
  let onRecorded: Mock<
    (file: File, previewUrl: string, recordedKind: 'audio' | 'video') => void | Promise<void>
  >;
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
    // MediaInput's preview (react-intersection-observer) needs an IntersectionObserver; jsdom has none.
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
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
      () =>
        ({
          clearRect: vi.fn(),
          fillRect: vi.fn(),
          beginPath: vi.fn(),
          moveTo: vi.fn(),
          lineTo: vi.fn(),
          stroke: vi.fn(),
          fillStyle: '',
          lineWidth: 1,
          strokeStyle: '',
        }) as unknown as CanvasRenderingContext2D,
    );
    // jsdom does not implement media playback.
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
      />,
    );
  }

  it('announces which recording kind is selected', async () => {
    const user = userEvent.setup();
    renderDialog({ initialKind: 'audio' });
    const video = screen.getByRole('button', { name: /^video$/i });
    const audio = screen.getByRole('button', { name: /^audio$/i });
    expect(audio).toHaveAttribute('aria-pressed', 'true');
    expect(video).toHaveAttribute('aria-pressed', 'false');

    await user.click(video);

    expect(video).toHaveAttribute('aria-pressed', 'true');
    expect(audio).toHaveAttribute('aria-pressed', 'false');
  });

  it('does not emit onRecorded when recording stops (Save gate)', async () => {
    const user = userEvent.setup();
    const { baseElement } = renderDialog();
    await user.click(screen.getByRole('button', { name: /^start$/i }));
    await user.click(screen.getByRole('button', { name: /^stop$/i }));
    expect(onRecorded).not.toHaveBeenCalled();
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

  it('Start stays disabled while the device is still starting, so a click cannot acquire it twice', async () => {
    let resolveGum!: (s: MediaStream) => void;
    gumMock.gum.mockImplementation(
      () =>
        new Promise<MediaStream>((res) => {
          resolveGum = res;
        }),
    );
    renderDialog();

    const start = screen.getByRole('button', { name: /^start$/i });
    expect(start).toBeDisabled();
    expect(screen.getByRole('status')).toHaveTextContent(/starting microphone/i);
    fireEvent.click(start);
    expect(gumMock.gum).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveGum(gumMock.stream);
    });
    expect(screen.getByRole('button', { name: /^start$/i })).toBeEnabled();
    expect(screen.queryByRole('status')).toBeNull();
    expect(gumMock.gum).toHaveBeenCalledTimes(1);
  });

  it('Start is never painted enabled before the device is ready, on first open or on reopen', async () => {
    const insertedEnabled: string[] = [];
    const observer = new MutationObserver(() => {});
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['disabled'],
      attributeOldValue: true,
    });
    const takeStartPaints = (phase: string) => {
      const records = observer.takeRecords();
      const start = screen.getByRole('button', { name: /^start$/i });
      const firstChange = records.find((r) => r.type === 'attributes' && r.target === start);
      const disabledWhenInserted = firstChange
        ? firstChange.oldValue !== null
        : start.hasAttribute('disabled');
      if (!disabledWhenInserted) insertedEnabled.push(phase);
    };
    gumMock.gum.mockImplementation(() => new Promise<MediaStream>(() => {}));
    const props = {
      onOpenChange,
      initialKind: 'audio' as const,
      canPhoto: false,
      canRecVideo: true,
      canRecAudio: true,
      onRecorded,
    };
    const { rerender } = render(<RecordDialog open {...props} />);
    takeStartPaints('first open');
    rerender(<RecordDialog open={false} {...props} />);
    observer.takeRecords();
    rerender(<RecordDialog open {...props} />);
    takeStartPaints('reopen');
    observer.disconnect();
    expect(insertedEnabled).toEqual([]);
  });

  it('a device that fails to start shows its error and leaves Start enabled to retry it', async () => {
    const user = userEvent.setup();
    gumMock.gum.mockRejectedValueOnce(new Error('Permission denied'));
    renderDialog();

    expect(await screen.findByRole('alert')).toHaveTextContent('Permission denied');
    const start = screen.getByRole('button', { name: /^start$/i });
    expect(start).toBeEnabled();

    await user.click(start);
    expect(gumMock.gum).toHaveBeenCalledTimes(2);
    expect(screen.getByRole('button', { name: /^stop$/i })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('writes a record_dialog diagnostic line for each recording decision while the Firefox failure is diagnosed', async () => {
    const user = userEvent.setup();
    const debug = vi.spyOn(console, 'debug').mockImplementation(() => {});
    renderDialog();
    await user.click(await screen.findByRole('button', { name: /^start$/i }));
    const events = debug.mock.calls.map(([line]) => String(line).split(' ')[0]);
    expect(events).toEqual([
      'record_dialog_open',
      'record_dialog_stream_request',
      'record_dialog_stream_ready',
      'record_dialog_start_click',
      'record_dialog_start_branch',
      'record_dialog_recorder_created',
      'record_dialog_recorder_started',
    ]);
    expect(debug.mock.calls[4][0]).toContain('"branch":"reuse"');
  });

  it('a device that finishes starting AFTER the dialog closed is stopped, never attached', async () => {
    let resolveGum!: (s: MediaStream) => void;
    gumMock.gum.mockImplementation(
      () =>
        new Promise<MediaStream>((res) => {
          resolveGum = res;
        }),
    );
    const { unmount } = renderDialog();
    unmount();

    const lateTracks = [{ stop: vi.fn() }, { stop: vi.fn() }];
    const lateStream = { getTracks: () => lateTracks } as unknown as MediaStream;
    await act(async () => {
      resolveGum(lateStream);
    });
    lateTracks.forEach((t) => expect(t.stop).toHaveBeenCalled());
  });

  it('Save shows pending and ignores a second click, so the recording is handed off once', async () => {
    const user = userEvent.setup();
    let finishHandOff!: () => void;
    onRecorded.mockImplementation(
      () =>
        new Promise<void>((res) => {
          finishHandOff = res;
        }),
    );
    renderDialog();
    await user.click(screen.getByRole('button', { name: /^start$/i }));
    await user.click(screen.getByRole('button', { name: /^stop$/i }));

    const save = screen.getByRole('button', { name: /^save$/i });
    await user.click(save);
    expect(save).toHaveAttribute('aria-busy', 'true');
    expect(save).toHaveAttribute('aria-disabled', 'true');
    fireEvent.click(save);
    expect(onRecorded).toHaveBeenCalledTimes(1);

    await act(async () => {
      finishHandOff();
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('revokes preview URL and returns to idle on Re-record', async () => {
    const user = userEvent.setup();
    renderDialog();
    await user.click(screen.getByRole('button', { name: /^start$/i }));
    await user.click(screen.getByRole('button', { name: /^stop$/i }));
    await user.click(screen.getByRole('button', { name: /re-?record/i }));
    expect(urlMock.revoke).toHaveBeenCalledWith('blob:mock-url');
    expect(screen.getByRole('button', { name: /^start$/i })).toBeInTheDocument();
    expect(onRecorded).not.toHaveBeenCalled();
  });

  it('shows discard confirmation when closing from preview without saving', async () => {
    const user = userEvent.setup();
    renderDialog();
    await user.click(screen.getByRole('button', { name: /^start$/i }));
    await user.click(screen.getByRole('button', { name: /^stop$/i }));
    // DialogContent injects its own sr-only "Close" button; the footer's Close is first in DOM order.
    const [footerCloseBtn] = screen.getAllByRole('button', { name: /^close$/i });
    await user.click(footerCloseBtn);
    expect(screen.getByText(/discard recording/i)).toBeInTheDocument();
    expect(onRecorded).not.toHaveBeenCalled();
  });

  it('cleans up MediaStream tracks on unmount', async () => {
    const user = userEvent.setup();
    const { unmount } = renderDialog();
    await user.click(screen.getByRole('button', { name: /^start$/i }));
    unmount();
    gumMock.tracks.forEach((t) => {
      expect(t.stop).toHaveBeenCalled();
    });
  });

  it('renders Photo button only when canPhoto + onRequestPhoto are provided', async () => {
    const onRequestPhoto = vi.fn();
    const { rerender } = renderDialog();
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
      />,
    );
    const photoBtn = screen.getByRole('button', { name: /^photo$/i });
    expect(photoBtn).toBeInTheDocument();
    const user = userEvent.setup();
    await user.click(photoBtn);
    expect(onRequestPhoto).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

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
    const { ctor, isTypeSupported } = installMediaRecorderMock({
      mimeType: 'audio/webm;codecs=opus',
      isTypeSupported: (t) => t === 'audio/webm;codecs=opus',
    });
    const file = await recordStopSave();
    expect(isTypeSupported).toHaveBeenCalledWith('audio/webm;codecs=opus');
    expect(ctor).toHaveBeenCalledWith(expect.anything(), { mimeType: 'audio/webm;codecs=opus' });
    expect(file.type).toBe('audio/webm');
    expect(file.name).toBe('recording.webm');
  });

  it('falls back to the no-argument constructor when isTypeSupported is unavailable (test environments)', async () => {
    const { ctor } = installMediaRecorderMock();
    const file = await recordStopSave();
    expect(ctor.mock.calls[0][1]).toBeUndefined();
    expect(file.type).toBe('audio/webm');
  });

  it('a recorder that reports video/* for a chosen-audio recording still emits audio/* (chosen kind wins)', async () => {
    installMediaRecorderMock({ mimeType: 'video/webm' });
    const file = await recordStopSave();
    expect(file.type).toBe('audio/webm');
  });

  it('passes the RECORDED KIND as the third onRecorded argument regardless of the recorder-reported MIME (the strong media-recorder claim source)', async () => {
    installMediaRecorderMock({ mimeType: 'video/mp4' });
    await recordStopSave();
    expect(onRecorded.mock.calls[0][2]).toBe('audio');
  });

  it('a recorder that reports video/mp4 for a chosen-audio recording emits audio/mp4 named recording.m4a', async () => {
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
    render(<MediaInput spec={spec} selectedFile={file} onChange={vi.fn()} onClear={vi.fn()} />);
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

  // Fake only the timers the recorder uses: the waveform loop relies on the stubbed rAF.
  function useRecorderFakeTimers() {
    vi.useFakeTimers({
      toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'],
    });
  }

  it('autoStopDelayMs leaves headroom under the cap, and never eats a short cap', () => {
    expect(autoStopDelayMs(60)).toBeLessThan(60_000);
    expect(autoStopDelayMs(60)).toBeGreaterThan(59_000);
    expect(autoStopDelayMs(1)).toBeGreaterThanOrEqual(500);
    expect(autoStopDelayMs(1)).toBeLessThan(1_000);
  });

  it('auto-stops before the cap boundary, not at it', async () => {
    useRecorderFakeTimers();
    try {
      const { instances } = installMediaRecorderMock();
      renderDialog();
      await act(async () => {});
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /^start$/i }));
      });
      const mr = instances[0];
      expect(mr.state).toBe('recording');

      const delay = autoStopDelayMs(60);
      await act(async () => {
        vi.advanceTimersByTime(delay - 1);
      });
      expect(mr.stop).not.toHaveBeenCalled();

      await act(async () => {
        vi.advanceTimersByTime(1);
      });
      expect(mr.stop).toHaveBeenCalledTimes(1);
      expect(delay).toBeLessThan(60_000);
      await act(async () => {
        vi.advanceTimersByTime(60_000);
      });
      expect(mr.stop).toHaveBeenCalledTimes(1);
      expect(screen.getByRole('button', { name: /^save$/i })).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it('shows the full cap in the elapsed label, not the earlier auto-stop point', async () => {
    useRecorderFakeTimers();
    try {
      installMediaRecorderMock();
      renderDialog();
      await act(async () => {});
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /^start$/i }));
      });
      expect(screen.getByText('0:00 / 1:00')).toBeInTheDocument();
      await act(async () => {
        vi.advanceTimersByTime(autoStopDelayMs(60) - 1);
      });
      expect(screen.getByText(/\/ 1:00$/)).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it('manual Stop still stops immediately and cancels the auto-stop timer', async () => {
    useRecorderFakeTimers();
    try {
      const { instances } = installMediaRecorderMock();
      renderDialog();
      await act(async () => {});
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /^start$/i }));
      });
      await act(async () => {
        vi.advanceTimersByTime(2_000);
      });
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /^stop$/i }));
      });
      const mr = instances[0];
      expect(mr.stop).toHaveBeenCalledTimes(1);
      expect(screen.getByRole('button', { name: /^save$/i })).toBeInTheDocument();
      await act(async () => {
        vi.advanceTimersByTime(120_000);
      });
      expect(mr.stop).toHaveBeenCalledTimes(1);
      expect(onRecorded).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
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
    render(<MediaInput spec={spec} selectedFile={file} onChange={vi.fn()} onClear={vi.fn()} />);
    expect(screen.getByText('Audio selected')).toBeInTheDocument();
    expect(screen.queryByText('Video selected')).toBeNull();
  });
});
