import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import type { MediaOriginSpec } from '@ttt-productions/media-schemas';
import type { MediaInputChangePayload } from '../src/types.js';
import { MediaInput } from '../src/react/components/media-input';

vi.mock('@ttt-productions/media-viewer/react', async () =>
  import('../../media-viewer/src/react/index.js'),
);

// jsdom cannot decode real media, so meta reading (Image/video element probes)
// never settles — return the kind inference the way readMediaMeta's fast path
// derives it. Claim derivation is what is under test, not media decoding.
vi.mock('../src/lib/read-media-meta.js', () => ({
  readMediaMeta: async (file: File) => {
    const t = file.type;
    const kind = t.startsWith('image/')
      ? 'image'
      : t.startsWith('video/')
        ? 'video'
        : t.startsWith('audio/')
          ? 'audio'
          : 'file';
    return { kind, mime: t || undefined, sizeBytes: file.size };
  },
}));

// The picker-path claim contract (canonical-upload-content-classification):
// a picked file emits an ADVISORY `file-picker` claim whose kind is the
// browser-metadata inference — and an UNKNOWN file passes through NEUTRALLY
// (application/octet-stream, claim kind 'file') instead of being fabricated
// into image/jpeg and/or rejected client-side.

const SPEC_MULTI_KIND: MediaOriginSpec = {
  kind: 'generic',
  accept: { kinds: ['image', 'video', 'audio'] },
  client: { allowPick: true, allowCapturePhoto: false, allowRecordVideo: false, allowRecordAudio: false },
};

describe('MediaInput picker claims', () => {
  let onChange: Mock<(payload: MediaInputChangePayload) => void>;

  beforeEach(() => {
    onChange = vi.fn();
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
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  function pick(file: File) {
    render(<MediaInput spec={SPEC_MULTI_KIND} onChange={onChange} />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(input).toBeTruthy();
    fireEvent.change(input, { target: { files: [file] } });
  }

  it('a picked image emits an advisory file-picker claim with the inferred kind', async () => {
    pick(new File(['x'], 'photo.jpg', { type: 'image/jpeg' }));
    await waitFor(() => expect(onChange).toHaveBeenCalled());
    const payload = onChange.mock.calls.at(-1)![0];
    expect(payload.error).toBeUndefined();
    expect(payload.claim).toEqual({ kind: 'image', source: 'file-picker' });
    expect(payload.file?.type).toBe('image/jpeg');
  });

  it('an UNKNOWN picked file passes through neutrally with a kind:file claim (no fabrication, no client rejection)', async () => {
    pick(new File(['x'], 'mystery.bin', { type: '' }));
    await waitFor(() => expect(onChange).toHaveBeenCalled());
    const payload = onChange.mock.calls.at(-1)![0];
    expect(payload.error).toBeUndefined(); // fail-open — the server inspector decides
    expect(payload.file?.type).toBe('application/octet-stream'); // never image/jpeg
    expect(payload.claim).toEqual({ kind: 'file', source: 'file-picker' });
  });

  it('a DEFINITIVELY wrong kind still rejects fast client-side (image-only origin, video file)', async () => {
    const imageOnly: MediaOriginSpec = {
      ...SPEC_MULTI_KIND,
      accept: { kinds: ['image'] },
    };
    render(<MediaInput spec={imageOnly} onChange={onChange} />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File(['x'], 'clip.mp4', { type: 'video/mp4' })] } });
    await waitFor(() => expect(onChange).toHaveBeenCalled());
    const payload = onChange.mock.calls.at(-1)![0];
    expect(payload.error?.code).toBe('invalid_type');
    expect(screen.getByText(/invalid file type/i)).toBeInTheDocument();
  });

  it('projects registry formats into the accept attribute when the origin selects them', () => {
    const withFormats: MediaOriginSpec = {
      kind: 'generic',
      accept: { kinds: ['audio'], formats: ['mp3', 'isobmff', 'webm'] },
      client: { allowPick: true, allowCapturePhoto: false, allowRecordVideo: false, allowRecordAudio: false },
    };
    render(<MediaInput spec={withFormats} onChange={onChange} />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const accept = input.getAttribute('accept') ?? '';
    expect(accept).toContain('audio/mp4'); // Safari audio container, kind-narrowed
    expect(accept).toContain('audio/webm');
    expect(accept).toContain('.m4a');
    expect(accept).not.toContain('video/mp4'); // audio origin never advertises video aliases
  });
});
