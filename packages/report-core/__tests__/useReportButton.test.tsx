// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { defineInputFormat } from '@ttt-productions/input-format-core';
import { render, renderHook, screen, cleanup, act, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReportCoreProvider } from '../src/context/ReportCoreProvider.js';
import { ReportButton, useReportButton } from '../src/components/ReportButton.js';
import type { ReportCoreConfig } from '../src/config.js';
import type { ReportDialogCopy } from '../src/types-ui-props.js';

afterEach(() => {
  cleanup();
});

const target = { itemType: 'message', itemId: 'm1', parentItemId: 'thread1' };

describe('useReportButton', () => {
  it('opens nothing and asks for sign-in when no reporter is signed in', () => {
    const onSignInRequired = vi.fn();
    const { result } = renderHook(() => useReportButton({ reporterUserId: undefined, onSignInRequired }));

    let opened = true;
    act(() => {
      opened = result.current.openReport(target);
    });

    expect(opened).toBe(false);
    expect(onSignInRequired).toHaveBeenCalledOnce();
    expect(result.current.open).toBe(false);
    expect(result.current.target).toBeNull();
  });

  it('opens for the signed-in reporter with the chosen target and closes on request', () => {
    const { result } = renderHook(() => useReportButton({ reporterUserId: 'a' }));

    act(() => {
      result.current.openReport(target);
    });
    expect(result.current.open).toBe(true);
    expect(result.current.target).toEqual(target);

    act(() => result.current.onOpenChange(false));
    expect(result.current.open).toBe(false);
  });

  it('reads closed with no target for a different signed-in reporter', () => {
    const { result, rerender } = renderHook(({ uid }) => useReportButton({ reporterUserId: uid }), {
      initialProps: { uid: 'a' },
    });
    act(() => {
      result.current.openReport(target);
    });

    rerender({ uid: 'b' });

    expect(result.current.open).toBe(false);
    expect(result.current.target).toBeNull();
    act(() => result.current.onOpenChange(true));
    expect(result.current.open).toBe(false);
  });
});

describe('ReportButton', () => {
  const copy = new Proxy({} as ReportDialogCopy, {
    get: (_t, key) => (key === 'formDescription' || key === 'upgradeDescription' ? () => String(key) : String(key)),
  });
  const config = {
    collections: {},
    reportableItems: {},
    reportReasons: ['Spam'],
    priorityConfig: {},
    taskQueues: {},
    reportCommentInput: defineInputFormat({ format: 'none', min: 1, max: 20 }),
  } as unknown as ReportCoreConfig;

  function renderButton(reporterUserId: string | undefined, onSignInRequired = vi.fn()) {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <ReportCoreProvider config={config} callFunction={vi.fn() as never}>
          <ReportButton
            itemType="post"
            itemId="p1"
            reporterUserId={reporterUserId}
            copy={copy}
            triggerLabel="Report this post"
            onSignInRequired={onSignInRequired}
            onSubmitSuccess={vi.fn()}
            onSubmitError={vi.fn()}
          />
        </ReportCoreProvider>
      </QueryClientProvider>,
    );
    return { onSignInRequired };
  }

  it('is a neutral, named, non-submitting trigger', () => {
    renderButton('a');
    const trigger = screen.getByRole('button', { name: 'Report this post' });
    expect(trigger).toHaveAttribute('type', 'button');
    expect(trigger.className).not.toMatch(/destructive/);
  });

  it('opens the dialog for a signed-in reporter', () => {
    renderButton('a');
    fireEvent.click(screen.getByRole('button', { name: 'Report this post' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('formTitle')).toBeInTheDocument();
  });

  it('asks for sign-in instead of opening when signed out', () => {
    const { onSignInRequired } = renderButton(undefined);
    fireEvent.click(screen.getByRole('button', { name: 'Report this post' }));
    expect(onSignInRequired).toHaveBeenCalledOnce();
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
