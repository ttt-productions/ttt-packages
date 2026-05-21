import { describe, it, expect, vi } from 'vitest';
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
