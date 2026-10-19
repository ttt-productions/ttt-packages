import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { MediaOriginSpec } from '@ttt-productions/media-schemas';
import { MediaInput } from '../src/react/components/media-input.js';
import { getCroppedImg } from '../src/lib/image-utils.js';

vi.mock(
  '@ttt-productions/media-viewer/react',
  async () => import('../../media-viewer/src/react/index.js'),
);

vi.mock('../src/lib/read-media-meta.js', () => ({
  readMediaMeta: async (file: File) => ({
    kind: 'image',
    mime: file.type,
    sizeBytes: file.size,
    width: 800,
    height: 800,
  }),
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

function imageSpec(imageCrop: NonNullable<MediaOriginSpec['imageCrop']>): MediaOriginSpec {
  return {
    kind: 'image',
    accept: { kinds: ['image'] },
    imageCrop,
    client: {
      allowPick: true,
      allowCapturePhoto: false,
      allowRecordVideo: false,
      allowRecordAudio: false,
    },
  };
}

beforeEach(() => {
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
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  vi.mocked(getCroppedImg).mockResolvedValue(new Blob(['img'], { type: 'image/jpeg' }));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.mocked(getCroppedImg).mockReset();
});

async function pickAndConfirmCrop(spec: MediaOriginSpec) {
  const onChange = vi.fn();
  render(<MediaInput spec={spec} onChange={onChange} />);
  fireEvent.change(document.querySelector('input[type="file"]') as HTMLInputElement, {
    target: { files: [new File(['x'], 'portrait.jpg', { type: 'image/jpeg' })] },
  });
  fireEvent.click(await screen.findByRole('button', { name: 'Confirm' }));
  await waitFor(() => expect(onChange).toHaveBeenCalled());
}

describe('MediaInput — crop encoding', () => {
  it('encodes the crop at the format and quality the origin spec declares', async () => {
    await pickAndConfirmCrop(
      imageSpec({
        aspectRatio: 1,
        outputWidth: 512,
        outputHeight: 512,
        format: 'jpeg',
        quality: 85,
      }),
    );
    expect(getCroppedImg).toHaveBeenCalledTimes(1);
    const args = vi.mocked(getCroppedImg).mock.calls[0];
    expect(args[4]).toBe(512);
    expect(args[5]).toBe(512);
    expect(args[6]).toEqual({ format: 'jpeg', quality: 85 });
  });

  it('passes a lossless declared format through to the encoder', async () => {
    await pickAndConfirmCrop(
      imageSpec({ aspectRatio: 1, outputWidth: 256, outputHeight: 256, format: 'png' }),
    );
    expect(vi.mocked(getCroppedImg).mock.calls[0][6]).toEqual({
      format: 'png',
      quality: undefined,
    });
  });
});
