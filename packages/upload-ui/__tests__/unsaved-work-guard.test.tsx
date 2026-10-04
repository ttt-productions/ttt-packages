import { describe, it, expect, vi, beforeEach, afterEach, type MockInstance } from 'vitest';
import { renderHook, act, render, screen, fireEvent } from '@testing-library/react';
import React, { useState } from 'react';
import {
  LocalUploadGuardProvider,
  useLocalUploadGuard,
  useUnsavedWorkGuard,
  type LocalUploadGuardProviderProps,
} from '../src/react/local-upload-guard-provider.js';
import { useGuardedNavigation } from '../src/react/use-guarded-navigation.js';

function wrapper({ children }: { children: React.ReactNode }) {
  return React.createElement(LocalUploadGuardProvider, null, children);
}

let addSpy: MockInstance<typeof window.addEventListener>;
let confirmSpy: MockInstance<typeof window.confirm>;

beforeEach(() => {
  addSpy = vi.spyOn(window, 'addEventListener');
  confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
});

afterEach(() => {
  vi.restoreAllMocks();
});

/** Runs the currently installed beforeunload handler against a fake event. */
function fireBeforeUnload() {
  const calls = addSpy.mock.calls.filter((c) => c[0] === 'beforeunload');
  const handler = calls[calls.length - 1]![1] as (e: BeforeUnloadEvent) => void;
  const preventDefault = vi.fn();
  const event = { preventDefault, returnValue: '' } as unknown as BeforeUnloadEvent;
  handler(event);
  return { prevented: preventDefault.mock.calls.length > 0, returnValue: event.returnValue };
}

function beforeUnloadListenerCount() {
  return addSpy.mock.calls.filter((c) => c[0] === 'beforeunload').length;
}

describe('unsaved work registered with the leave guard', () => {
  it('counts unsaved work apart from uploads, and both in the guarded total', () => {
    const { result } = renderHook(() => useLocalUploadGuard(), { wrapper });
    act(() => result.current.registerUnsavedWork('draft'));
    expect(result.current.unsavedWorkCount).toBe(1);
    expect(result.current.activeUploadCount).toBe(0);
    expect(result.current.guardedWorkCount).toBe(1);

    act(() => result.current.registerUpload('draft'));
    expect(result.current.activeUploadCount).toBe(1);
    expect(result.current.guardedWorkCount).toBe(2);

    act(() => result.current.unregisterUnsavedWork('draft'));
    expect(result.current.unsavedWorkCount).toBe(0);
    expect(result.current.guardedWorkCount).toBe(1);
  });

  it('ignores a repeated registration and an absent unregistration', () => {
    const { result } = renderHook(() => useLocalUploadGuard(), { wrapper });
    act(() => result.current.registerUnsavedWork('draft'));
    act(() => result.current.registerUnsavedWork('draft'));
    act(() => result.current.unregisterUnsavedWork('never'));
    expect(result.current.unsavedWorkCount).toBe(1);
  });

  it('warns on a full-page leave while unsaved work alone is registered, and stops once it clears', () => {
    const { result } = renderHook(() => useLocalUploadGuard(), { wrapper });
    expect(beforeUnloadListenerCount()).toBe(0);

    act(() => result.current.registerUnsavedWork('draft'));
    expect(beforeUnloadListenerCount()).toBe(1);
    const leave = fireBeforeUnload();
    expect(leave.prevented).toBe(true);
    expect(leave.returnValue.toLowerCase()).toContain('unsaved');

    const removeSpy = vi.spyOn(window, 'removeEventListener');
    act(() => result.current.unregisterUnsavedWork('draft'));
    expect(removeSpy.mock.calls.some((c) => c[0] === 'beforeunload')).toBe(true);
    expect(result.current.shouldConfirmNavigation()).toBe(false);
  });

  it('asks before an in-app navigation with the unsaved-work message and returns the choice', () => {
    const { result } = renderHook(() => useLocalUploadGuard(), { wrapper });
    act(() => result.current.registerUnsavedWork('draft'));

    expect(result.current.shouldConfirmNavigation()).toBe(true);
    expect(result.current.confirmNavigation()).toBe(false);
    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(String(confirmSpy.mock.calls[0]![0]).toLowerCase()).toContain('unsaved');

    confirmSpy.mockReturnValue(true);
    expect(result.current.confirmNavigation()).toBe(true);
  });

  it('names both losses when an upload and unsaved work are registered', () => {
    const { result } = renderHook(() => useLocalUploadGuard(), { wrapper });
    act(() => {
      result.current.registerUpload('file');
      result.current.registerUnsavedWork('draft');
    });
    result.current.confirmNavigation();
    const message = String(confirmSpy.mock.calls[0]![0]).toLowerCase();
    expect(message).toContain('upload');
    expect(message).toContain('unsaved');
  });

  it('shows the message the app supplies for each case', () => {
    const props: Omit<LocalUploadGuardProviderProps, 'children'> = {
      navigationConfirmMessage: 'app upload message',
      unsavedWorkConfirmMessage: 'app unsaved message',
      uploadAndUnsavedWorkConfirmMessage: 'app both message',
    };
    const { result } = renderHook(() => useLocalUploadGuard(), {
      wrapper: ({ children }) => <LocalUploadGuardProvider {...props}>{children}</LocalUploadGuardProvider>,
    });
    act(() => result.current.registerUnsavedWork('draft'));
    result.current.confirmNavigation();
    act(() => result.current.registerUpload('file'));
    result.current.confirmNavigation();
    act(() => result.current.unregisterUnsavedWork('draft'));
    result.current.confirmNavigation();
    expect(confirmSpy.mock.calls.map((c) => c[0])).toEqual([
      'app unsaved message',
      'app both message',
      'app upload message',
    ]);
  });

  it('a confirmed full-page navigation lets exactly the next beforeunload through', () => {
    confirmSpy.mockReturnValue(true);
    const { result } = renderHook(() => useLocalUploadGuard(), { wrapper });
    act(() => result.current.registerUnsavedWork('draft'));

    expect(result.current.confirmNavigation({ fullPageNavigation: true })).toBe(true);
    expect(fireBeforeUnload().prevented).toBe(false);
    expect(fireBeforeUnload().prevented).toBe(true);
  });

  it('unsaved work registered after a confirmation clears the bypass', () => {
    confirmSpy.mockReturnValue(true);
    const { result } = renderHook(() => useLocalUploadGuard(), { wrapper });
    act(() => result.current.registerUpload('file'));
    result.current.confirmNavigation({ fullPageNavigation: true });

    act(() => result.current.registerUnsavedWork('draft'));

    expect(fireBeforeUnload().prevented).toBe(true);
  });
});

describe('useUnsavedWorkGuard', () => {
  function Editor() {
    const [text, setText] = useState('');
    useUnsavedWorkGuard(text !== '');
    return (
      <div>
        <input aria-label="draft" value={text} onChange={(e) => setText(e.target.value)} />
        <button type="button" onClick={() => setText('')}>
          Save
        </button>
      </div>
    );
  }

  function Page({ showEditor }: { showEditor: boolean }) {
    const guard = useLocalUploadGuard();
    const navigate = useGuardedNavigation();
    const [left, setLeft] = useState(false);
    return (
      <div>
        {showEditor ? <Editor /> : null}
        <span data-testid="unsaved">{guard.unsavedWorkCount}</span>
        <button type="button" onClick={() => navigate(() => setLeft(true))}>
          Leave
        </button>
        <span data-testid="left">{String(left)}</span>
      </div>
    );
  }

  function renderPage(showEditor = true) {
    return render(
      <LocalUploadGuardProvider>
        <Page showEditor={showEditor} />
      </LocalUploadGuardProvider>,
    );
  }

  it('navigates without asking while the editor holds nothing unsaved', () => {
    renderPage();
    fireEvent.click(screen.getByText('Leave'));
    expect(confirmSpy).not.toHaveBeenCalled();
    expect(screen.getByTestId('left')).toHaveTextContent('true');
  });

  it('asks before navigating away from typed input, and stays when the user declines', () => {
    renderPage();
    fireEvent.change(screen.getByLabelText('draft'), { target: { value: 'a chapter' } });
    expect(screen.getByTestId('unsaved')).toHaveTextContent('1');

    fireEvent.click(screen.getByText('Leave'));
    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('left')).toHaveTextContent('false');
  });

  it('unregisters once the input is saved', () => {
    renderPage();
    fireEvent.change(screen.getByLabelText('draft'), { target: { value: 'a chapter' } });
    fireEvent.click(screen.getByText('Save'));
    expect(screen.getByTestId('unsaved')).toHaveTextContent('0');
    fireEvent.click(screen.getByText('Leave'));
    expect(confirmSpy).not.toHaveBeenCalled();
  });

  it('unregisters when the editor unmounts', () => {
    const view = renderPage();
    fireEvent.change(screen.getByLabelText('draft'), { target: { value: 'a chapter' } });
    view.rerender(
      <LocalUploadGuardProvider>
        <Page showEditor={false} />
      </LocalUploadGuardProvider>,
    );
    expect(screen.getByTestId('unsaved')).toHaveTextContent('0');
  });

  it('keeps two dirty editors registered separately', () => {
    function TwoEditors() {
      const guard = useLocalUploadGuard();
      return (
        <div>
          <Editor />
          <Editor />
          <span data-testid="unsaved">{guard.unsavedWorkCount}</span>
        </div>
      );
    }
    render(
      <LocalUploadGuardProvider>
        <TwoEditors />
      </LocalUploadGuardProvider>,
    );
    const [first, second] = screen.getAllByLabelText('draft');
    fireEvent.change(first!, { target: { value: 'one' } });
    fireEvent.change(second!, { target: { value: 'two' } });
    expect(screen.getByTestId('unsaved')).toHaveTextContent('2');
  });

  it('release lets an editor that just saved navigate in the same handler without asking', () => {
    function SaveAndLeave() {
      const [text, setText] = useState('');
      const { release } = useUnsavedWorkGuard(text !== '');
      const navigate = useGuardedNavigation();
      const [left, setLeft] = useState(false);
      return (
        <div>
          <input aria-label="draft" value={text} onChange={(e) => setText(e.target.value)} />
          <button
            type="button"
            onClick={() => {
              release();
              navigate(() => setLeft(true));
            }}
          >
            Save and leave
          </button>
          <span data-testid="left">{String(left)}</span>
        </div>
      );
    }
    render(
      <LocalUploadGuardProvider>
        <SaveAndLeave />
      </LocalUploadGuardProvider>,
    );
    fireEvent.change(screen.getByLabelText('draft'), { target: { value: 'saved text' } });
    fireEvent.click(screen.getByText('Save and leave'));
    expect(confirmSpy).not.toHaveBeenCalled();
    expect(screen.getByTestId('left')).toHaveTextContent('true');
  });

  it('throws outside a provider', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => renderHook(() => useUnsavedWorkGuard(true))).toThrow(
      /must be used within LocalUploadGuardProvider/i,
    );
  });
});
