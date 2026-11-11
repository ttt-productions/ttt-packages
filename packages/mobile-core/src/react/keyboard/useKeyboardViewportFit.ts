import { useEffect, useMemo, type CSSProperties, type RefObject } from 'react';
import { useKeyboard } from './useKeyboard.js';
import { useVisualViewport } from '../viewport/useVisualViewport.js';

export const KEYBOARD_VIEWPORT_FIT_MARGIN = 8;

export interface VisibleViewportMetrics {
  height: number;
  offsetTop: number;
  scale: number;
}

export interface KeyboardViewportFit {
  centerY: number;
  maxHeight: number;
}

// A pinch-zoom shrinks the visual viewport the way a keyboard does, so only an unzoomed one is fitted.
export function keyboardViewportFit(
  keyboardOpen: boolean,
  viewport: VisibleViewportMetrics | null,
): KeyboardViewportFit | null {
  if (!keyboardOpen || !viewport) return null;
  if (Math.abs(viewport.scale - 1) > 0.01) return null;
  return {
    centerY: viewport.offsetTop + viewport.height / 2,
    maxHeight: Math.max(0, viewport.height - 2 * KEYBOARD_VIEWPORT_FIT_MARGIN),
  };
}

export function keyboardViewportFitStyle(
  fit: KeyboardViewportFit | null,
): CSSProperties | undefined {
  if (!fit) return undefined;
  return { top: `${fit.centerY}px`, maxHeight: `${fit.maxHeight}px`, overflowY: 'auto' };
}

export function scrollFocusedIntoContainer(container: HTMLElement): void {
  const focused = document.activeElement;
  if (!(focused instanceof HTMLElement) || focused === container || !container.contains(focused)) {
    return;
  }
  const box = container.getBoundingClientRect();
  const field = focused.getBoundingClientRect();
  const visibleTop = box.top + KEYBOARD_VIEWPORT_FIT_MARGIN;
  const visibleBottom = box.bottom - KEYBOARD_VIEWPORT_FIT_MARGIN;
  if (field.top < visibleTop) {
    container.scrollTop -= visibleTop - field.top;
  } else if (field.bottom > visibleBottom) {
    container.scrollTop += Math.min(field.bottom - visibleBottom, field.top - visibleTop);
  }
}

export function useKeyboardViewportFit(
  ref: RefObject<HTMLElement | null>,
): CSSProperties | undefined {
  const keyboard = useKeyboard();
  const viewport = useVisualViewport();
  const fit = keyboardViewportFit(keyboard.isOpen, viewport.visualViewport ? viewport : null);
  const centerY = fit?.centerY ?? null;
  const maxHeight = fit?.maxHeight ?? null;

  useEffect(() => {
    const container = ref.current;
    if (maxHeight === null || !container) return;
    scrollFocusedIntoContainer(container);
    const onFocusIn = () => scrollFocusedIntoContainer(container);
    container.addEventListener('focusin', onFocusIn);
    return () => container.removeEventListener('focusin', onFocusIn);
  }, [ref, maxHeight]);

  return useMemo(
    () =>
      keyboardViewportFitStyle(
        centerY === null || maxHeight === null ? null : { centerY, maxHeight },
      ),
    [centerY, maxHeight],
  );
}
