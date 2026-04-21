import React from 'react';
import { render, screen, act, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RecordDialog } from '../src/components/record-dialog';

// Fake MediaRecorder:
type MRCtor = new (stream: MediaStream, opts?: MediaRecorderOptions) => MediaRecorder;

function installMediaRecorderMock() {
  const instances: any[] = [];
  const ctor = vi.fn().mockImplementation((stream: MediaStream, _opts?: any) => {
    const inst: any = {
      state: 'inactive',
      mimeType: 'audio/webm',
      ondataavailable: null,
      onstop: null,
      start: vi.fn(function (this: any) { this.state = 'recording'; }),
      stop: vi.fn(function (this: any) {
        this.state = 'inactive';
        // Simulate a chunk, then fire onstop synchronously so the preview state flips before assertions
        act(() => {
          this.ondataavailable?.({ data: new Blob(['chunk'], { type: 'audio/webm' }), size: 5 } as any);
          this.onstop?.();
        });
      }),
      stream,
    };
    instances.push(inst);
    return inst;
  });
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
  const ctor = vi.fn().mockImplementation(() => ({
    state: 'running',
    close: vi.fn().mockResolvedValue(undefined),
    createMediaStreamSource: vi.fn().mockReturnValue(source),
    createAnalyser: vi.fn().mockReturnValue(analyser),
  }));
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
  let onRecorded: ReturnType<typeof vi.fn>;
  let onOpenChange: ReturnType<typeof vi.fn>;
  let mrMock: ReturnType<typeof installMediaRecorderMock>;
  let gumMock: ReturnType<typeof installGetUserMediaMock>;
  let acMock: ReturnType<typeof installAudioContextMock>;
  let urlMock: ReturnType<typeof installObjectUrlMock>;

  beforeEach(() => {
    onRecorded = vi.fn();
    onOpenChange = vi.fn();
    mrMock = installMediaRecorderMock();
    gumMock = installGetUserMediaMock();
    acMock = installAudioContextMock();
    urlMock = installObjectUrlMock();
    // Stub play to avoid jsdom errors
    Object.defineProperty(HTMLMediaElement.prototype, 'play', {
      configurable: true,
      value: vi.fn().mockResolvedValue(undefined),
    });
  });

  afterEach(() => {
    cleanup();
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
    renderDialog();
    await user.click(screen.getByRole('button', { name: /^start$/i }));
    // mr.start was called; now stop
    await user.click(screen.getByRole('button', { name: /^stop$/i }));
    // After stop, dialog transitions to preview state. onRecorded MUST NOT have fired.
    expect(onRecorded).not.toHaveBeenCalled();
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
});
