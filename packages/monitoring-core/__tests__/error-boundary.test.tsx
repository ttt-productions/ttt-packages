import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import * as React from 'react';

const mockCaptureException = vi.hoisted(() => vi.fn());

vi.mock('../src/api', () => ({
  captureException: mockCaptureException,
  captureMessage: vi.fn(),
  setUser: vi.fn(),
  setTag: vi.fn(),
  withScope: vi.fn(),
  addBreadcrumb: vi.fn(),
}));

import { ErrorBoundary } from '../src/react/error-boundary';

function ThrowingChild({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) throw new Error('test render error');
  return <div>child content</div>;
}

beforeEach(() => {
  mockCaptureException.mockClear();
  // Suppress React's error boundary console.error output in tests
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('ErrorBoundary', () => {
  it('renders children when no error occurs', () => {
    render(
      <ErrorBoundary fallback={<div>fallback</div>} context="test-page">
        <ThrowingChild shouldThrow={false} />
      </ErrorBoundary>,
    );
    expect(screen.getByText('child content')).toBeInTheDocument();
    expect(screen.queryByText('fallback')).not.toBeInTheDocument();
  });

  it('renders fallback when a child throws', () => {
    render(
      <ErrorBoundary fallback={<div>fallback shown</div>} context="test-page">
        <ThrowingChild shouldThrow={true} />
      </ErrorBoundary>,
    );
    expect(screen.getByText('fallback shown')).toBeInTheDocument();
    expect(screen.queryByText('child content')).not.toBeInTheDocument();
  });

  it('calls captureException with componentStack and context', () => {
    render(
      <ErrorBoundary fallback={<div>err</div>} context="my-context">
        <ThrowingChild shouldThrow={true} />
      </ErrorBoundary>,
    );
    expect(mockCaptureException).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ context: 'my-context', componentStack: expect.anything() }),
    );
  });

  it('calls onError callback when provided', () => {
    const onError = vi.fn();
    render(
      <ErrorBoundary fallback={<div>err</div>} context="test" onError={onError}>
        <ThrowingChild shouldThrow={true} />
      </ErrorBoundary>,
    );
    expect(onError).toHaveBeenCalledWith(expect.any(Error), expect.anything());
  });
});
