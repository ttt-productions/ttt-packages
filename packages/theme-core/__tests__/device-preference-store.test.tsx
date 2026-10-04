import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { createDevicePreferenceStore } from '../src/react/device-preference-store';

// Values held for a blocked page live for the module's life, so every test takes its own keys.
let nextPrefix = 0;
function newSizeStore() {
  nextPrefix += 1;
  const storageKey = `pref-${nextPrefix}`;
  const changeEvent = `pref-${nextPrefix}-change`;
  const store = createDevicePreferenceStore<'standard' | 'large'>({
    storageKey,
    changeEvent,
    parse: (stored) => (stored === 'standard' || stored === 'large' ? stored : undefined),
    serialize: (value) => value,
    fallback: 'standard',
  });
  return { store, storageKey, changeEvent };
}

const blocked = () => new DOMException('The operation is insecure.', 'SecurityError');

function Reader({ store }: { store: ReturnType<typeof newSizeStore>['store'] }) {
  return <span data-testid="value">{store.useValue()}</span>;
}

describe('createDevicePreferenceStore', () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it('reads the fallback while nothing is saved', () => {
    const { store } = newSizeStore();
    expect(store.get()).toBe('standard');
  });

  it('reads the fallback for a saved string it does not recognise', () => {
    const { store, storageKey } = newSizeStore();
    window.localStorage.setItem(storageKey, 'enormous');
    expect(store.get()).toBe('standard');
  });

  it('saves through serialize and reads back through parse', () => {
    const { store, storageKey } = newSizeStore();
    store.set('large');
    expect(window.localStorage.getItem(storageKey)).toBe('large');
    expect(store.get()).toBe('large');
  });

  it('clears the saved value back to the fallback', () => {
    const { store, storageKey } = newSizeStore();
    store.set('large');
    store.clear();
    expect(window.localStorage.getItem(storageKey)).toBeNull();
    expect(store.get()).toBe('standard');
  });

  it('notifies this tab through the change event on set and clear', () => {
    const { store, changeEvent } = newSizeStore();
    const heard = vi.fn();
    window.addEventListener(changeEvent, heard);
    store.set('large');
    store.clear();
    window.removeEventListener(changeEvent, heard);
    expect(heard).toHaveBeenCalledTimes(2);
  });

  it('re-renders a reader on a save in this tab', () => {
    const { store } = newSizeStore();
    render(<Reader store={store} />);
    expect(screen.getByTestId('value')).toHaveTextContent('standard');
    act(() => store.set('large'));
    expect(screen.getByTestId('value')).toHaveTextContent('large');
  });

  it('follows a save made in another tab through the storage event', () => {
    const { store, storageKey } = newSizeStore();
    render(<Reader store={store} />);
    act(() => {
      window.localStorage.setItem(storageKey, 'large');
      window.dispatchEvent(new StorageEvent('storage', { key: storageKey, newValue: 'large' }));
    });
    expect(screen.getByTestId('value')).toHaveTextContent('large');
  });

  it('stops notifying after unsubscribe', () => {
    const { store } = newSizeStore();
    const heard = vi.fn();
    const unsubscribe = store.subscribe(heard);
    store.set('large');
    unsubscribe();
    store.set('standard');
    window.dispatchEvent(new StorageEvent('storage'));
    expect(heard).toHaveBeenCalledTimes(1);
  });

  it('returns the same value object for the same saved string', () => {
    nextPrefix += 1;
    const store = createDevicePreferenceStore<{ step: number }>({
      storageKey: `pref-${nextPrefix}`,
      changeEvent: `pref-${nextPrefix}-change`,
      parse: (stored) => {
        const step = Number(stored);
        return Number.isInteger(step) ? { step } : undefined;
      },
      serialize: (value) => String(value.step),
      fallback: { step: 0 },
    });
    store.set({ step: 2 });
    expect(store.get()).toBe(store.get());
    expect(store.get()).toEqual({ step: 2 });
  });

  it('renders the fallback on the server', () => {
    const { store, storageKey } = newSizeStore();
    window.localStorage.setItem(storageKey, 'large');
    expect(renderToString(<Reader store={store} />)).toContain('standard');
  });
});

describe('createDevicePreferenceStore with blocked storage', () => {
  const ownLocalStorage = Object.getOwnPropertyDescriptor(window, 'localStorage');
  afterEach(() => {
    vi.restoreAllMocks();
    if (ownLocalStorage) Object.defineProperty(window, 'localStorage', ownLocalStorage);
  });

  it('renders the fallback when every Storage call throws, and a save still applies for the page', () => {
    for (const method of ['getItem', 'setItem', 'removeItem'] as const) {
      vi.spyOn(Storage.prototype, method).mockImplementation(() => {
        throw blocked();
      });
    }
    const { store } = newSizeStore();
    render(<Reader store={store} />);
    expect(screen.getByTestId('value')).toHaveTextContent('standard');
    act(() => store.set('large'));
    expect(screen.getByTestId('value')).toHaveTextContent('large');
    act(() => store.clear());
    expect(screen.getByTestId('value')).toHaveTextContent('standard');
  });

  it('renders the fallback when reading window.localStorage throws, and a save still applies', () => {
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get() {
        throw blocked();
      },
    });
    const { store } = newSizeStore();
    render(<Reader store={store} />);
    expect(screen.getByTestId('value')).toHaveTextContent('standard');
    act(() => store.set('large'));
    expect(screen.getByTestId('value')).toHaveTextContent('large');
  });
});
