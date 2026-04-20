import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render } from '@testing-library/react';
import type { MediaJobStatusPayload } from '@ttt-productions/media-contracts';
import { MediaJobStatusList } from '../src/components/media-job-status-list';

const FIXED_NOW = new Date('2026-04-20T12:00:00Z').getTime();

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(FIXED_NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

function make(overrides: Partial<MediaJobStatusPayload> = {}): MediaJobStatusPayload {
  return {
    status: 'ready',
    updatedAt: FIXED_NOW,
    mediaDocId: 'doc-1',
    ...(overrides as any),
  } as MediaJobStatusPayload;
}

describe('MediaJobStatusList', () => {
  describe('empty / filtering', () => {
    it('returns null when items is empty', () => {
      const { container } = render(<MediaJobStatusList items={[]} />);
      expect(container).toBeEmptyDOMElement();
    });

    it('returns null when all items are filtered out by recentHours', () => {
      const ancient = make({ updatedAt: FIXED_NOW - 48 * 60 * 60 * 1000 });
      const { container } = render(
        <MediaJobStatusList items={[ancient]} recentHours={1} showOnlyRecent />
      );
      expect(container).toBeEmptyDOMElement();
    });

    it('includes items older than recentHours when showOnlyRecent=false', () => {
      const ancient = make({ updatedAt: FIXED_NOW - 48 * 60 * 60 * 1000, mediaDocId: 'old-1' });
      const { getByText } = render(
        <MediaJobStatusList items={[ancient]} recentHours={1} showOnlyRecent={false} />
      );
      expect(getByText('old-1')).toBeInTheDocument();
    });

    it('respects maxItems (slices after sort+filter)', () => {
      const items = Array.from({ length: 10 }, (_, i) =>
        make({ mediaDocId: `doc-${i}`, updatedAt: FIXED_NOW - i * 1000 })
      );
      const { container } = render(<MediaJobStatusList items={items} maxItems={3} />);
      // count "doc-" mentions — one per list item (the mediaDocId span)
      expect(container.querySelectorAll('.truncate').length).toBeGreaterThanOrEqual(3);
      // Check first 3 by id are present, last 7 are not
      expect(container.textContent).toContain('doc-0');
      expect(container.textContent).toContain('doc-1');
      expect(container.textContent).toContain('doc-2');
      expect(container.textContent).not.toContain('doc-3');
      expect(container.textContent).not.toContain('doc-9');
    });
  });

  describe('sort order', () => {
    it('sorts items by updatedAt descending (newest first)', () => {
      const older = make({ mediaDocId: 'older', updatedAt: FIXED_NOW - 10_000 });
      const newest = make({ mediaDocId: 'newest', updatedAt: FIXED_NOW - 1_000 });
      const middle = make({ mediaDocId: 'middle', updatedAt: FIXED_NOW - 5_000 });

      const { container } = render(
        <MediaJobStatusList items={[older, newest, middle]} />
      );
      const text = container.textContent ?? '';
      const iNewest = text.indexOf('newest');
      const iMiddle = text.indexOf('middle');
      const iOlder = text.indexOf('older');
      expect(iNewest).toBeLessThan(iMiddle);
      expect(iMiddle).toBeLessThan(iOlder);
    });
  });

  describe('status badges and labels', () => {
    const cases: Array<[MediaJobStatusPayload['status'], string]> = [
      ['uploading', 'Uploading'],
      ['queued', 'Queued'],
      ['processing', 'AI Processing'],
      ['ready', 'Ready'],
      ['rejected', 'Rejected'],
      ['failed', 'Failed'],
      ['selecting', 'Selecting'],
    ];

    for (const [status, label] of cases) {
      it(`renders "${label}" label for status="${status}"`, () => {
        const { getByText } = render(
          <MediaJobStatusList items={[make({ status })]} />
        );
        expect(getByText(label)).toBeInTheDocument();
      });
    }

    it('falls through to String(status) for unknown status', () => {
      const { getByText } = render(
        <MediaJobStatusList items={[make({ status: 'weird' as any })]} />
      );
      expect(getByText('weird')).toBeInTheDocument();
    });
  });

  describe('progress bar', () => {
    it('renders progress bar for status="uploading" with value clamped to 0-100', () => {
      const { container } = render(
        <MediaJobStatusList items={[make({ status: 'uploading', progress: 0.42 })]} />
      );
      expect(container.textContent).toContain('42%');
    });

    it('clamps progress above 1 to 100', () => {
      const { container } = render(
        <MediaJobStatusList items={[make({ status: 'uploading', progress: 2 })]} />
      );
      expect(container.textContent).toContain('100%');
    });

    it('clamps negative progress to 0', () => {
      const { container } = render(
        <MediaJobStatusList items={[make({ status: 'uploading', progress: -0.5 })]} />
      );
      expect(container.textContent).toContain('0%');
    });

    it('treats missing progress on uploading as 0', () => {
      const { container } = render(
        <MediaJobStatusList items={[make({ status: 'uploading' })]} />
      );
      expect(container.textContent).toContain('0%');
    });

    it('renders 100% progress for status="ready"', () => {
      const { container } = render(
        <MediaJobStatusList items={[make({ status: 'ready' })]} />
      );
      expect(container.textContent).toContain('100%');
    });

    it('does NOT render a progress bar for status="processing"', () => {
      const { container } = render(
        <MediaJobStatusList items={[make({ status: 'processing' })]} />
      );
      expect(container.textContent).not.toContain('%');
    });

    it('does NOT render a progress bar for status="failed"', () => {
      const { container } = render(
        <MediaJobStatusList items={[make({ status: 'failed' })]} />
      );
      expect(container.textContent).not.toContain('%');
    });
  });

  describe('processing spinner', () => {
    it('adds animate-spin class to the icon when status="processing"', () => {
      const { container } = render(
        <MediaJobStatusList items={[make({ status: 'processing' })]} />
      );
      expect(container.querySelector('.animate-spin')).toBeInTheDocument();
    });

    it('does NOT add animate-spin when status is not processing', () => {
      const { container } = render(
        <MediaJobStatusList items={[make({ status: 'ready' })]} />
      );
      expect(container.querySelector('.animate-spin')).not.toBeInTheDocument();
    });
  });

  describe('optional fields', () => {
    it('renders mediaDocId when present', () => {
      const { getByText } = render(
        <MediaJobStatusList items={[make({ mediaDocId: 'abc-123' })]} />
      );
      expect(getByText('abc-123')).toBeInTheDocument();
    });

    it('renders reasonCode when present', () => {
      const { getByText } = render(
        <MediaJobStatusList
          items={[make({ status: 'rejected', reasonCode: 'POLICY_VIOLATION' })]}
        />
      );
      expect(getByText('POLICY_VIOLATION')).toBeInTheDocument();
    });

    it('does not crash when mediaDocId and reasonCode are missing', () => {
      const { container } = render(
        <MediaJobStatusList items={[{ status: 'ready', updatedAt: FIXED_NOW } as MediaJobStatusPayload]} />
      );
      expect(container.textContent).toContain('Ready');
    });
  });

  describe('updatedAt parsing', () => {
    it('accepts numeric updatedAt', () => {
      const { container } = render(
        <MediaJobStatusList items={[make({ updatedAt: FIXED_NOW - 3_000 })]} />
      );
      expect(container.textContent).toContain('Ready');
    });

    it('accepts ISO string updatedAt', () => {
      const iso = new Date(FIXED_NOW - 3_000).toISOString();
      const { container } = render(
        <MediaJobStatusList items={[make({ updatedAt: iso as any })]} />
      );
      expect(container.textContent).toContain('Ready');
    });

    it('falls back to now() when updatedAt is missing', () => {
      const { container } = render(
        <MediaJobStatusList
          items={[{ status: 'ready', mediaDocId: 'no-ts' } as MediaJobStatusPayload]}
        />
      );
      // Not filtered out because getUpdatedAtMs returned Date.now() == FIXED_NOW
      expect(container.textContent).toContain('no-ts');
    });

    it('falls back to now() when updatedAt is an unparseable string', () => {
      const { container } = render(
        <MediaJobStatusList
          items={[make({ updatedAt: 'not-a-date' as any, mediaDocId: 'bad-ts' })]}
        />
      );
      expect(container.textContent).toContain('bad-ts');
    });
  });

  describe('className pass-through', () => {
    it('applies custom className to the Card root', () => {
      const { container } = render(
        <MediaJobStatusList items={[make({})]} className="custom-xy" />
      );
      expect(container.firstChild).toHaveClass('custom-xy');
    });
  });
});
