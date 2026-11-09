import * as React from 'react';
import { useInView } from 'react-intersection-observer';
import { mediaSizeNeed, pickMediaSize } from '../media-size.js';
import type { MediaSizeOption } from '../media-size.js';

export interface UseWantedMediaSizeOptions {
  sizes?: readonly MediaSizeOption[];
  onSizeWanted?: (key: string) => void;
  priority?: boolean;
  observeView: boolean;
}

function readWidth(element: HTMLElement): number {
  return element.getBoundingClientRect().width;
}

export function useWantedMediaSize({
  sizes,
  onSizeWanted,
  priority = false,
  observeView,
}: UseWantedMediaSizeOptions): (element: HTMLElement | null) => void {
  const wantsSize = sizes !== undefined && sizes.length > 0 && onSizeWanted !== undefined;
  const sizesSignature = wantsSize ? sizes.map(({ key, width }) => `${key}:${width}`).join() : '';

  const { ref: inViewRef, inView } = useInView({
    triggerOnce: true,
    threshold: 0,
    rootMargin: '50px',
    skip: !wantsSize || priority || !observeView,
  });
  const [element, setElement] = React.useState<HTMLElement | null>(null);
  const [drawnWidth, setDrawnWidth] = React.useState(0);
  const requested = React.useRef<{ signature: string; width: number } | null>(null);

  const slotRef = React.useCallback(
    (node: HTMLElement | null) => {
      inViewRef(node);
      setElement(node);
    },
    [inViewRef],
  );

  React.useEffect(() => {
    if (!wantsSize || element === null) return;
    setDrawnWidth(readWidth(element));
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => setDrawnWidth(readWidth(element)));
    observer.observe(element);
    return () => observer.disconnect();
  }, [wantsSize, element]);

  const shown = priority || inView || !observeView;

  React.useEffect(() => {
    if (!wantsSize || !shown || drawnWidth <= 0) return;
    const pixelRatio = typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1;
    const size = pickMediaSize(sizes, mediaSizeNeed(drawnWidth, pixelRatio));
    if (size === null) return;
    const last = requested.current;
    if (last !== null && last.signature === sizesSignature && last.width >= size.width) return;
    requested.current = { signature: sizesSignature, width: size.width };
    onSizeWanted(size.key);
  }, [wantsSize, shown, drawnWidth, sizes, sizesSignature, onSizeWanted]);

  return slotRef;
}
