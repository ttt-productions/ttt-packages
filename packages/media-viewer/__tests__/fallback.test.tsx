import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { shouldShowFallback, MediaFallbackLink } from '../src/fallback';

describe('shouldShowFallback', () => {
  it('returns true for undefined', () => {
    expect(shouldShowFallback(undefined)).toBe(true);
  });

  it('returns true for "link"', () => {
    expect(shouldShowFallback('link')).toBe(true);
  });

  it('returns false for "none"', () => {
    expect(shouldShowFallback('none')).toBe(false);
  });
});

describe('MediaFallbackLink', () => {
  it('renders an anchor element', () => {
    render(<MediaFallbackLink url="https://example.com/file.mp4" />);
    const anchor = screen.getByRole('link');
    expect(anchor).toBeInTheDocument();
  });

  it('sets href to provided url', () => {
    render(<MediaFallbackLink url="https://example.com/file.mp4" />);
    expect(screen.getByRole('link')).toHaveAttribute('href', 'https://example.com/file.mp4');
  });

  it('opens in new tab (target=_blank)', () => {
    render(<MediaFallbackLink url="https://example.com/file.mp4" />);
    expect(screen.getByRole('link')).toHaveAttribute('target', '_blank');
  });

  it('sets rel=noreferrer for security', () => {
    render(<MediaFallbackLink url="https://example.com/file.mp4" />);
    expect(screen.getByRole('link')).toHaveAttribute('rel', 'noreferrer');
  });

  it('renders default "Download" label when no label provided', () => {
    render(<MediaFallbackLink url="https://example.com/file.mp4" />);
    expect(screen.getByText('Download')).toBeInTheDocument();
  });

  it('renders custom label', () => {
    render(<MediaFallbackLink url="https://example.com/file.mp4" label="View File" />);
    expect(screen.getByText('View File')).toBeInTheDocument();
    expect(screen.queryByText('Download')).not.toBeInTheDocument();
  });

  it('sets download attribute when filename provided', () => {
    render(<MediaFallbackLink url="https://example.com/file.mp4" filename="video.mp4" />);
    expect(screen.getByRole('link')).toHaveAttribute('download', 'video.mp4');
  });

  it('does not set download attribute when no filename', () => {
    render(<MediaFallbackLink url="https://example.com/file.mp4" />);
    expect(screen.getByRole('link')).not.toHaveAttribute('download');
  });

  it('applies custom className', () => {
    render(<MediaFallbackLink url="https://example.com/file.mp4" className="my-class" />);
    expect(screen.getByRole('link')).toHaveClass('my-class');
  });
});
