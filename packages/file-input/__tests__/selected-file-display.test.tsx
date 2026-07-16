import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { MediaOriginSpec } from '@ttt-productions/media-schemas';
import { FileInput } from '../src/react/components/file-input';
import { MediaInput } from '../src/react/components/media-input';

vi.mock('@ttt-productions/media-viewer/react', () => ({
  MediaPreview: (props: { type?: string; className?: string }) => (
    <div data-testid="media-preview" data-type={props.type} className={props.className} />
  ),
}));

describe('selected file display', () => {
  it('uses a semantic audio label and gives the canonical player natural height', () => {
    const spec: MediaOriginSpec = {
      kind: 'audio',
      accept: { kinds: ['audio'], mimes: ['audio/webm'] },
    };

    render(
      <MediaInput
        spec={spec}
        selectedFile={new File(['audio'], 'recording.webm', { type: 'audio/webm' })}
        onChange={vi.fn()}
        onClear={vi.fn()}
      />,
    );

    expect(screen.getByText('Audio selected')).toBeInTheDocument();
    expect(screen.queryByText('recording.webm')).toBeNull();
    const preview = screen.getByTestId('media-preview');
    expect(preview).toHaveAttribute('data-type', 'audio');
    expect(preview.parentElement).toHaveClass('p-2');
    expect(preview.parentElement).not.toHaveClass('h-16');
    expect(preview.parentElement).not.toHaveClass('overflow-hidden');
  });

  it('hides the original filename in the legacy FileInput', () => {
    render(
      <FileInput
        acceptTypes={['image']}
        maxSizeMB={{ image: 10 }}
        selectedFile={new File(['image'], 'cropped1.jpeg', { type: 'image/jpeg' })}
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByText('Image selected')).toBeInTheDocument();
    expect(screen.queryByText('cropped1.jpeg')).toBeNull();
  });
});
