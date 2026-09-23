import { describe, it, expect, vi, beforeEach, afterEach, type MockInstance } from 'vitest';
import { render, fireEvent, act, renderHook } from '@testing-library/react';
import React from 'react';
import { LocalUploadGuardProvider, useLocalUploadGuard } from '../src/react/local-upload-guard-provider.js';
import { GuardedLink } from '../src/react/guarded-link.js';
import { useGuardedNavigation } from '../src/react/use-guarded-navigation.js';

function Wrapper({ children }: { children: React.ReactNode }) {
  return <LocalUploadGuardProvider>{children}</LocalUploadGuardProvider>;
}

describe('GuardedLink', () => {
  it('renders via renderLink and navigates immediately when no uploads active', () => {
    const onNavigated = vi.fn();
    const { getByTestId } = render(
      <Wrapper>
        <GuardedLink
          renderLink={({ onClick, children }) => (
            <a
              data-testid="link"
              href="/dest"
              onClick={(e) => {
                onClick(e);
                if (!e.defaultPrevented) onNavigated();
              }}
            >
              {children}
            </a>
          )}
        >
          Go
        </GuardedLink>
      </Wrapper>,
    );
    fireEvent.click(getByTestId('link'));
    expect(onNavigated).toHaveBeenCalled();
  });

  it('prompts and blocks navigation when uploads are active and user cancels', () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const onNavigated = vi.fn();

    function TestHarness() {
      const { registerUpload } = useLocalUploadGuard();
      React.useEffect(() => {
        registerUpload('u1');
      }, [registerUpload]);
      return (
        <GuardedLink
          renderLink={({ onClick, children }) => (
            <a
              data-testid="link"
              href="/dest"
              onClick={(e) => {
                onClick(e);
                if (!e.defaultPrevented) onNavigated();
              }}
            >
              {children}
            </a>
          )}
        >
          Go
        </GuardedLink>
      );
    }

    const { getByTestId } = render(
      <Wrapper>
        <TestHarness />
      </Wrapper>,
    );
    fireEvent.click(getByTestId('link'));
    expect(confirmSpy).toHaveBeenCalled();
    expect(onNavigated).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });
});

describe('useGuardedNavigation', () => {
  it('runs the navigation immediately when no uploads active', () => {
    const { result } = renderHook(() => useGuardedNavigation(), { wrapper: Wrapper });
    const nav = vi.fn();
    act(() => result.current(nav));
    expect(nav).toHaveBeenCalled();
  });

  it('skips the navigation when the user cancels the confirm prompt', () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);

    function TestHarness({ trigger }: { trigger: (run: (nav: () => void) => void) => void }) {
      const { registerUpload } = useLocalUploadGuard();
      const guardedNav = useGuardedNavigation();
      React.useEffect(() => {
        registerUpload('u1');
      }, [registerUpload]);
      trigger((run: () => void) => guardedNav(run));
      return null;
    }

    let runGuardedNav: ((nav: () => void) => void) | null = null;
    render(
      <Wrapper>
        <TestHarness
          trigger={(run) => {
            runGuardedNav = run;
          }}
        />
      </Wrapper>,
    );
    const nav = vi.fn();
    act(() => runGuardedNav!(nav));
    expect(confirmSpy).toHaveBeenCalled();
    expect(nav).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });
});

describe('useGuardedNavigation — full-page navigation', () => {
  let addSpy: MockInstance<typeof window.addEventListener>;
  let confirmSpy: MockInstance<typeof window.confirm>;
  beforeEach(() => {
    addSpy = vi.spyOn(window, 'addEventListener');
    confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
  });
  afterEach(() => {
    addSpy.mockRestore();
    confirmSpy.mockRestore();
  });

  function renderWithActiveUpload() {
    const hook = renderHook(() => ({ guard: useLocalUploadGuard(), guardedNav: useGuardedNavigation() }), {
      wrapper: Wrapper,
    });
    act(() => hook.result.current.guard.registerUpload('u1'));
    return hook;
  }

  /** Runs the installed beforeunload handler; true when it warned (prevented the unload). */
  function nextUnloadWarns(): boolean {
    const calls = addSpy.mock.calls.filter((c) => c[0] === 'beforeunload');
    const handler = calls[calls.length - 1]![1] as (e: BeforeUnloadEvent) => void;
    const preventDefault = vi.fn();
    handler({ preventDefault, returnValue: '' } as unknown as BeforeUnloadEvent);
    return preventDefault.mock.calls.length > 0;
  }

  it('a confirmed full-page navigation runs and its unload is not prompted a second time', () => {
    const { result } = renderWithActiveUpload();
    const nav = vi.fn();
    act(() => result.current.guardedNav(nav, { fullPageNavigation: true }));
    expect(nav).toHaveBeenCalledTimes(1);
    expect(nextUnloadWarns()).toBe(false);
  });

  it('a soft navigation (no option) never arms the bypass', () => {
    const { result } = renderWithActiveUpload();
    const nav = vi.fn();
    act(() => result.current.guardedNav(nav));
    expect(nav).toHaveBeenCalledTimes(1);
    expect(nextUnloadWarns()).toBe(true);
  });

  it('a declined full-page navigation neither runs nor arms the bypass', () => {
    confirmSpy.mockReturnValue(false);
    const { result } = renderWithActiveUpload();
    const nav = vi.fn();
    act(() => result.current.guardedNav(nav, { fullPageNavigation: true }));
    expect(nav).not.toHaveBeenCalled();
    expect(nextUnloadWarns()).toBe(true);
  });
});
