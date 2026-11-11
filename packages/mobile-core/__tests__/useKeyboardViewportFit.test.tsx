import { describe, it, expect, afterAll, afterEach, vi } from 'vitest';
import { useRef } from 'react';
import { act, render, screen } from '@testing-library/react';

// The visual viewport is set before env.ts loads, since the module reads it once at load.
const viewport = vi.hoisted(() => {
  class FakeVisualViewport extends EventTarget {
    width = 390;
    height = 800;
    offsetTop = 0;
    offsetLeft = 0;
    pageTop = 0;
    pageLeft = 0;
    scale = 1;
  }
  const fake = new FakeVisualViewport();
  Object.defineProperty(window, 'visualViewport', { configurable: true, value: fake });
  Object.defineProperty(window, 'innerHeight', { configurable: true, writable: true, value: 800 });
  return fake;
});

import {
  KEYBOARD_VIEWPORT_FIT_MARGIN,
  keyboardViewportFit,
  keyboardViewportFitStyle,
  scrollFocusedIntoContainer,
  useKeyboardViewportFit,
} from '../src/react/keyboard/useKeyboardViewportFit.js';

const M = KEYBOARD_VIEWPORT_FIT_MARGIN;

function setViewport(height: number, offsetTop = 0, scale = 1) {
  act(() => {
    viewport.height = height;
    viewport.offsetTop = offsetTop;
    viewport.scale = scale;
    viewport.dispatchEvent(new Event('resize'));
  });
}

function rect(top: number, bottom: number): DOMRect {
  return DOMRect.fromRect({ x: 0, y: top, width: 300, height: bottom - top });
}

afterEach(() => {
  setViewport(800);
});

afterAll(() => {
  delete (window as { visualViewport?: unknown }).visualViewport;
});

describe('keyboardViewportFit', () => {
  it('leaves the layout alone while no keyboard is open', () => {
    expect(keyboardViewportFit(false, { height: 450, offsetTop: 0, scale: 1 })).toBeNull();
  });

  it('leaves the layout alone where the browser has no visual viewport', () => {
    expect(keyboardViewportFit(true, null)).toBeNull();
  });

  it('centres on the visible area above the keyboard and fits inside it, margin on each edge', () => {
    expect(keyboardViewportFit(true, { height: 450, offsetTop: 120, scale: 1 })).toEqual({
      centerY: 120 + 450 / 2,
      maxHeight: 450 - 2 * M,
    });
  });

  it('does not fit to a viewport shrunk by a pinch-zoom', () => {
    expect(keyboardViewportFit(true, { height: 400, offsetTop: 50, scale: 2 })).toBeNull();
  });
});

describe('keyboardViewportFitStyle', () => {
  it('adds no style when there is nothing to fit', () => {
    expect(keyboardViewportFitStyle(null)).toBeUndefined();
  });

  it('places the element at the visible centre, caps its height and lets its content scroll', () => {
    expect(keyboardViewportFitStyle({ centerY: 345, maxHeight: 434 })).toEqual({
      top: '345px',
      maxHeight: '434px',
      overflowY: 'auto',
    });
  });
});

describe('scrollFocusedIntoContainer', () => {
  function setup(fieldTop: number, fieldBottom: number) {
    const container = document.createElement('div');
    const field = document.createElement('input');
    container.appendChild(field);
    document.body.appendChild(container);
    container.getBoundingClientRect = () => rect(100, 500);
    field.getBoundingClientRect = () => rect(fieldTop, fieldBottom);
    container.scrollTop = 200;
    field.focus();
    return { container, field };
  }

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('scrolls a field below the visible part up until it sits a margin above the bottom', () => {
    const { container } = setup(560, 600);
    scrollFocusedIntoContainer(container);
    expect(container.scrollTop).toBe(200 + (600 - (500 - M)));
  });

  it('scrolls a field above the visible part down until it sits a margin below the top', () => {
    const { container } = setup(40, 80);
    scrollFocusedIntoContainer(container);
    expect(container.scrollTop).toBe(200 - (100 + M - 40));
  });

  it('keeps the top of a field taller than the visible part in view', () => {
    const { container } = setup(300, 900);
    scrollFocusedIntoContainer(container);
    expect(container.scrollTop).toBe(200 + (300 - (100 + M)));
  });

  it('does not scroll for a field already in view', () => {
    const { container } = setup(200, 240);
    scrollFocusedIntoContainer(container);
    expect(container.scrollTop).toBe(200);
  });

  it('does not scroll for focus outside the container', () => {
    const { container } = setup(560, 600);
    const outside = document.createElement('input');
    document.body.appendChild(outside);
    outside.focus();
    scrollFocusedIntoContainer(container);
    expect(container.scrollTop).toBe(200);
  });
});

function FittedPanel() {
  const ref = useRef<HTMLDivElement | null>(null);
  const style = useKeyboardViewportFit(ref);
  return (
    <div ref={ref} data-testid="panel" style={style}>
      <input aria-label="first" />
      <input aria-label="second" />
    </div>
  );
}

describe('useKeyboardViewportFit', () => {
  it('adds no style while the keyboard is closed', () => {
    render(<FittedPanel />);
    expect(screen.getByTestId('panel').getAttribute('style')).toBeNull();
  });

  it('follows the visible viewport while the keyboard is open and lets go when it closes', () => {
    render(<FittedPanel />);
    const panel = screen.getByTestId('panel');

    setViewport(450, 120);
    expect(panel.style.top).toBe(`${120 + 450 / 2}px`);
    expect(panel.style.maxHeight).toBe(`${450 - 2 * M}px`);
    expect(panel.style.overflowY).toBe('auto');

    setViewport(450, 60);
    expect(panel.style.top).toBe(`${60 + 450 / 2}px`);

    setViewport(800);
    expect(panel.style.top).toBe('');
    expect(panel.style.maxHeight).toBe('');
    expect(panel.style.overflowY).toBe('');
  });

  it('brings a field focused while the keyboard is open into view inside the panel', () => {
    render(<FittedPanel />);
    const panel = screen.getByTestId('panel');
    const second = screen.getByLabelText('second');
    panel.getBoundingClientRect = () => rect(100, 500);
    second.getBoundingClientRect = () => rect(560, 600);
    panel.scrollTop = 0;

    setViewport(450, 0);
    act(() => second.focus());

    expect(panel.scrollTop).toBe(600 - (500 - M));
  });
});
