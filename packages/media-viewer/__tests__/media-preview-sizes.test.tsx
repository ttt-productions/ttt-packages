import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render } from '@testing-library/react';
import { mockAllIsIntersecting } from 'react-intersection-observer/test-utils';
import { MediaPreview } from '../src/react/media-viewer.js';

const SIZES = [
  { key: 'sm', width: 720 },
  { key: 'md', width: 1440 },
  { key: 'lg', width: 2400 },
];

let drawnWidth = 0;
const resizeCallbacks: Array<() => void> = [];

class FakeResizeObserver {
  private readonly callback: () => void;
  constructor(callback: () => void) {
    this.callback = callback;
  }
  observe() {
    resizeCallbacks.push(this.callback);
  }
  disconnect() {
    const at = resizeCallbacks.indexOf(this.callback);
    if (at >= 0) resizeCallbacks.splice(at, 1);
  }
  unobserve() {}
}

function drawAt(width: number) {
  drawnWidth = width;
  act(() => {
    for (const callback of [...resizeCallbacks]) callback();
  });
}

beforeEach(() => {
  drawnWidth = 360;
  vi.stubGlobal('ResizeObserver', FakeResizeObserver);
  vi.stubGlobal('devicePixelRatio', 2);
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
    () => ({ width: drawnWidth, height: 100 }) as DOMRect,
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  resizeCallbacks.length = 0;
});

describe('MediaPreview asking the app for a size', () => {
  it('asks for nothing while its spot is off screen, then for the size its spot needs', () => {
    const onSizeWanted = vi.fn();
    render(
      <MediaPreview
        type="image"
        download={{ status: 'pending' }}
        sizes={SIZES}
        onSizeWanted={onSizeWanted}
      />,
    );
    expect(onSizeWanted).not.toHaveBeenCalled();

    act(() => mockAllIsIntersecting(true));

    expect(onSizeWanted).toHaveBeenCalledTimes(1);
    expect(onSizeWanted).toHaveBeenCalledWith('sm');
  });

  it('asks at once for a priority picture', () => {
    const onSizeWanted = vi.fn();
    render(
      <MediaPreview
        type="image"
        priority
        download={{ status: 'pending' }}
        sizes={SIZES}
        onSizeWanted={onSizeWanted}
      />,
    );
    expect(onSizeWanted).toHaveBeenCalledWith('sm');
  });

  it('follows the drawn width: a wide spot on a 2× screen asks for the large size', () => {
    drawnWidth = 1000;
    const onSizeWanted = vi.fn();
    render(
      <MediaPreview
        type="image"
        priority
        download={{ status: 'pending' }}
        sizes={SIZES}
        onSizeWanted={onSizeWanted}
      />,
    );
    expect(onSizeWanted).toHaveBeenCalledWith('lg');
  });

  it('moves up a size when its spot is drawn wider, and never down', () => {
    const onSizeWanted = vi.fn();
    render(
      <MediaPreview
        type="image"
        priority
        download={{ status: 'pending' }}
        sizes={SIZES}
        onSizeWanted={onSizeWanted}
      />,
    );
    drawAt(700);
    drawAt(300);

    expect(onSizeWanted.mock.calls).toEqual([['sm'], ['md']]);
  });

  it('asks nothing again when re-rendered with the same sizes in a new array', () => {
    const onSizeWanted = vi.fn();
    const { rerender } = render(
      <MediaPreview
        type="image"
        priority
        download={{ status: 'pending' }}
        sizes={SIZES}
        onSizeWanted={onSizeWanted}
      />,
    );
    rerender(
      <MediaPreview
        type="image"
        priority
        download={{ status: 'pending' }}
        sizes={[...SIZES]}
        onSizeWanted={onSizeWanted}
      />,
    );
    expect(onSizeWanted).toHaveBeenCalledTimes(1);
  });
});
