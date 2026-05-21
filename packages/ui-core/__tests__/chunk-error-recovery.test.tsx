import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { ChunkErrorRecovery } from '../src/react/components/chunk-error-recovery';

const reloadMock = vi.fn();

beforeEach(() => {
  reloadMock.mockClear();
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { ...window.location, reload: reloadMock },
  });
  vi.spyOn(console, 'error').mockImplementation(() => { });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('ChunkErrorRecovery', () => {
  it('renders children normally when no error', () => {
    render(
      <ChunkErrorRecovery>
        <p>normal content</p>
      </ChunkErrorRecovery>,
    );
    expect(screen.getByText('normal content')).toBeInTheDocument();
  });

  it('shows loading state and calls reload on chunk error', () => {
    render(
      <ChunkErrorRecovery>
        <p>content</p>
      </ChunkErrorRecovery>,
    );

    act(() => {
      const event = new ErrorEvent('error', {
        message: 'Failed to load chunk 123.js',
        error: new Error('Failed to load chunk 123.js'),
      });
      window.dispatchEvent(event);
    });

    expect(reloadMock).toHaveBeenCalled();
    expect(screen.getByText('Updating…')).toBeInTheDocument();
    expect(screen.queryByText('content')).not.toBeInTheDocument();
  });

  it('does not reload for unrelated errors', () => {
    render(
      <ChunkErrorRecovery>
        <p>content</p>
      </ChunkErrorRecovery>,
    );

    act(() => {
      const event = new ErrorEvent('error', {
        message: 'ReferenceError: foo is not defined',
      });
      window.dispatchEvent(event);
    });

    expect(reloadMock).not.toHaveBeenCalled();
    expect(screen.getByText('content')).toBeInTheDocument();
  });

  it('renders custom loadingMessage', () => {
    render(
      <ChunkErrorRecovery loadingMessage="Refreshing...">
        <p>content</p>
      </ChunkErrorRecovery>,
    );

    act(() => {
      const event = new ErrorEvent('error', {
        message: 'Failed to load chunk 1.js',
      });
      window.dispatchEvent(event);
    });

    expect(screen.getByText('Refreshing...')).toBeInTheDocument();
  });

  it('respects custom isChunkError predicate', () => {
    const isChunkError = vi.fn((e: ErrorEvent) => e.message.includes('MODULE_NOT_FOUND'));
    render(
      <ChunkErrorRecovery isChunkError={isChunkError}>
        <p>content</p>
      </ChunkErrorRecovery>,
    );

    act(() => {
      window.dispatchEvent(new ErrorEvent('error', { message: 'MODULE_NOT_FOUND' }));
    });

    expect(reloadMock).toHaveBeenCalled();
  });
});
