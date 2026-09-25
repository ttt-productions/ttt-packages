// jsdom has no matchMedia. This double answers every query, lets a test flip the device's
// reduced-motion request, and fires the listeners both APIs register: the store's
// addEventListener and next-themes' addListener.

type Listener = () => void;

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

export interface MatchMediaControl {
  setReducedMotion(matches: boolean): void;
}

export function installMatchMedia({ reducedMotion = false } = {}): MatchMediaControl {
  let reduced = reducedMotion;
  const listeners = new Set<Listener>();

  (window as unknown as { matchMedia: (query: string) => MediaQueryList }).matchMedia = (query) =>
    ({
      get matches() {
        return query === REDUCED_MOTION_QUERY ? reduced : false;
      },
      media: query,
      onchange: null,
      addEventListener: (_type: string, listener: Listener) => {
        if (query === REDUCED_MOTION_QUERY) listeners.add(listener);
      },
      removeEventListener: (_type: string, listener: Listener) => listeners.delete(listener),
      addListener: (listener: Listener) => {
        if (query === REDUCED_MOTION_QUERY) listeners.add(listener);
      },
      removeListener: (listener: Listener) => listeners.delete(listener),
      dispatchEvent: () => false,
    }) as unknown as MediaQueryList;

  return {
    setReducedMotion(matches) {
      reduced = matches;
      listeners.forEach((listener) => listener());
    },
  };
}

export function removeMatchMedia(): void {
  delete (window as unknown as { matchMedia?: unknown }).matchMedia;
}
