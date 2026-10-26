import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { MediaOriginSpec } from '@ttt-productions/media-schemas';
import { MediaInput } from '../src/react/components/media-input.js';
import { getCroppedImg } from '../src/lib/image-utils.js';

vi.mock(import('../src/lib/read-media-meta.js'), async (importOriginal) => {
  const { stubModule } = await import('@ttt-productions/dev-standards/testing');
  return stubModule(importOriginal, {
    readMediaMeta: async (file: File) => ({
      kind: 'image',
      mime: file.type,
      sizeBytes: file.size,
      width: 800,
      height: 800,
    }),
  });
});

vi.mock(import('../src/lib/image-utils.js'), async (importOriginal) => {
  const { stubModule } = await import('@ttt-productions/dev-standards/testing');
  return stubModule(importOriginal, {
    getCroppedImg: vi.fn<typeof import('../src/lib/image-utils.js').getCroppedImg>(),
  });
});

vi.mock(import('react-easy-crop'), async (importOriginal) => {
  const { reactEasyCropFake } = await import('./helpers/react-easy-crop-fake.js');
  return reactEasyCropFake(importOriginal);
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
  URL.createObjectURL = vi.fn().mockReturnValue('blob:mock-url');
  URL.revokeObjectURL = vi.fn();
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
