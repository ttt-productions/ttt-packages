import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, act } from '@testing-library/react';
import { mockAllIsIntersecting } from 'react-intersection-observer/test-utils';
import type { MediaDiagnosticAdapter, DiagnosisResult } from '../src/recovery.js';
import { MediaPreview } from '../src/react/media-viewer.js';

const PLACEHOLDER = <span data-testid="emblem">emblem</span>;

function probeAnswering(result: DiagnosisResult): MediaDiagnosticAdapter['probe'] {
  return vi.fn<(url: string) => Promise<DiagnosisResult>>().mockResolvedValue(result);
}

async function failImage(container: HTMLElement) {
  const img = container.querySelector('img');
  expect(img).toBeInTheDocument();
  await act(async () => {
    fireEvent.error(img!);
    await Promise.resolve();
  });
}

describe('MediaPreview placeholder — every non-content state shows it and no label', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runAllTimers();
    vi.useRealTimers();
  });

  it('an image still loading shows the placeholder, not a skeleton', () => {
    const { container, getByTestId } = render(
      <MediaPreview url="https://cdn.example.com/a.jpg" type="image" placeholder={PLACEHOLDER} />,
    );
    mockAllIsIntersecting(0.01);
    expect(getByTestId('emblem')).toBeInTheDocument();
    expect(container.querySelector('img')).toBeInTheDocument();
  });

  it('a loaded image drops the placeholder', async () => {
    const { container, queryByTestId } = render(
      <MediaPreview url="https://cdn.example.com/b.jpg" type="image" placeholder={PLACEHOLDER} />,
    );
    mockAllIsIntersecting(0.01);
    await act(async () => {
      fireEvent.load(container.querySelector('img')!);
    });
    expect(queryByTestId('emblem')).not.toBeInTheDocument();
  });

  it('auth retry shows the placeholder and no "Refreshing access" text', async () => {
    const adapter: MediaDiagnosticAdapter = {
      probe: probeAnswering({ kind: 'auth' }),
      refreshSession: vi.fn(() => new Promise<void>(() => {})),
    };
    const { container, getByTestId } = render(
      <MediaPreview
        url="https://cdn.example.com/c.jpg"
        type="image"
        recoveryAdapter={adapter}
        placeholder={PLACEHOLDER}
      />,
    );
    mockAllIsIntersecting(0.01);
    await failImage(container);
    expect(getByTestId('emblem')).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/Refreshing access/);
    expect(container.querySelector('.mv-recovery-label')).not.toBeInTheDocument();
  });

  it('hard-unavailable shows the placeholder and no "Media unavailable" text', async () => {
    const adapter: MediaDiagnosticAdapter = { probe: probeAnswering({ kind: 'hard' }) };
    const { container, getByTestId } = render(
      <MediaPreview
        url="https://cdn.example.com/d.jpg"
        type="image"
        recoveryAdapter={adapter}
        placeholder={PLACEHOLDER}
      />,
    );
    mockAllIsIntersecting(0.01);
    await failImage(container);
    expect(getByTestId('emblem')).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/Media unavailable/);
    expect(container.querySelector('.mv-recovery-label')).not.toBeInTheDocument();
  });

  it('a transient retry shows the placeholder and no "Loading" text', async () => {
    const adapter: MediaDiagnosticAdapter = { probe: probeAnswering({ kind: 'transient' }) };
    const { container, getByTestId } = render(
      <MediaPreview
        url="https://cdn.example.com/e.jpg"
        type="image"
        recoveryAdapter={adapter}
        placeholder={PLACEHOLDER}
      />,
    );
    mockAllIsIntersecting(0.01);
    await failImage(container);
    expect(getByTestId('emblem')).toBeInTheDocument();
    expect(container.querySelector('.mv-recovery-label')).not.toBeInTheDocument();
  });

  it('a pending or missing URL shows the placeholder', () => {
    const pending = render(<MediaPreview url={null} urlPending placeholder={PLACEHOLDER} />);
    expect(pending.getByTestId('emblem')).toBeInTheDocument();
    pending.unmount();
    const missing = render(<MediaPreview url={null} placeholder={PLACEHOLDER} />);
    expect(missing.getByTestId('emblem')).toBeInTheDocument();
  });

  it('a failed image with no recovery adapter shows the placeholder', async () => {
    const { container, getByTestId } = render(
      <MediaPreview url="https://cdn.example.com/f.jpg" type="image" placeholder={PLACEHOLDER} />,
    );
    mockAllIsIntersecting(0.01);
    await failImage(container);
    expect(getByTestId('emblem')).toBeInTheDocument();
  });

  it('without a placeholder the recovery label still renders', async () => {
    const adapter: MediaDiagnosticAdapter = {
      probe: probeAnswering({ kind: 'auth' }),
      refreshSession: vi.fn(() => new Promise<void>(() => {})),
    };
    const { container } = render(
      <MediaPreview url="https://cdn.example.com/g.jpg" type="image" recoveryAdapter={adapter} />,
    );
    mockAllIsIntersecting(0.01);
    await failImage(container);
    expect(container.textContent).toMatch(/Refreshing access/);
  });
});
