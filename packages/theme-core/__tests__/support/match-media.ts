// jsdom has no matchMedia; this double fires the listeners both APIs register: the store's
// addEventListener and next-themes' addListener.

type Listener = (event: Event) => void;

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

export interface MatchMediaControl {
  setReducedMotion(matches: boolean): void;
}

export function installMatchMedia({ reducedMotion = false } = {}): MatchMediaControl {
  let reduced = reducedMotion;
  const listeners = new Set<Listener>();

  window.matchMedia = (query): MediaQueryList => ({
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
  });

  return {
    setReducedMotion(matches) {
      reduced = matches;
      const change = new Event('change');
      listeners.forEach((listener) => listener(change));
    },
  };
}

export function removeMatchMedia(): void {
  Reflect.deleteProperty(window, 'matchMedia');
}
