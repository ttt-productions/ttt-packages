import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { MediaInput } from '../src/react/components/media-input';
import { TTT_MEDIA_SPECS } from '@ttt-productions/media-contracts';

const spec = TTT_MEDIA_SPECS['library-cover-square'];

afterEach(() => {
  cleanup();
});

describe('MediaInput cancel button', () => {
  it('renders cancel button during preparing phase when onCancel is set and isLoading is true', () => {
    render(
      <MediaInput
        spec={spec}
        isLoading
        uploadState={{ phase: 'preparing', percent: null }}
        onCancel={vi.fn()}
        onChange={vi.fn()}
      />
    );
    expect(screen.getByLabelText('Cancel upload')).toBeTruthy();
  });

  it('renders cancel button during uploading phase when onCancel is set and isLoading is true', () => {
    render(
      <MediaInput
        spec={spec}
        isLoading
        uploadState={{ phase: 'uploading', percent: 50 }}
        onCancel={vi.fn()}
        onChange={vi.fn()}
      />
    );
    expect(screen.getByLabelText('Cancel upload')).toBeTruthy();
  });

  it('does NOT render cancel button during finalizing phase', () => {
    render(
      <MediaInput
        spec={spec}
        isLoading
        uploadState={{ phase: 'finalizing', percent: null }}
        onCancel={vi.fn()}
        onChange={vi.fn()}
      />
    );
    expect(screen.queryByLabelText('Cancel upload')).toBeNull();
  });

  it('does NOT render cancel button when onCancel is undefined', () => {
    render(
      <MediaInput
        spec={spec}
        isLoading
        uploadState={{ phase: 'uploading', percent: 25 }}
        onChange={vi.fn()}
      />
    );
    expect(screen.queryByLabelText('Cancel upload')).toBeNull();
  });

  it('does NOT render cancel button when isLoading is false', () => {
    render(
      <MediaInput
        spec={spec}
        isLoading={false}
        uploadState={{ phase: 'uploading', percent: 25 }}
        onCancel={vi.fn()}
        onChange={vi.fn()}
      />
    );
    expect(screen.queryByLabelText('Cancel upload')).toBeNull();
  });

  it('invokes onCancel callback when the cancel button is clicked', async () => {
    const onCancel = vi.fn();
    render(
      <MediaInput
        spec={spec}
        isLoading
        uploadState={{ phase: 'uploading', percent: 75 }}
        onCancel={onCancel}
        onChange={vi.fn()}
      />
    );
    await userEvent.click(screen.getByLabelText('Cancel upload'));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
