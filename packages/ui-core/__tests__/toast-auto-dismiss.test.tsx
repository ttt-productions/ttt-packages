import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, fireEvent, act } from '@testing-library/react';
import { Toast, ToastProvider, ToastViewport, ToastTitle } from '../src/react/components/toast.js';

function renderToast(props: React.ComponentProps<typeof Toast>) {
    return render(
        <ToastProvider>
            <Toast {...props}>
                <ToastTitle>Body</ToastTitle>
            </Toast>
            <ToastViewport />
        </ToastProvider>,
    );
}

// The countdown bar is the element carrying the `toast-progress` CSS animation.
function findBar(container: HTMLElement): HTMLElement | null {
    return container.querySelector<HTMLElement>('.origin-left');
}

/** Ends `animationName` on `el` after it ran for `elapsedMs`, as the browser reports it in seconds. */
function fireAnimationEnd(el: HTMLElement, animationName: string, elapsedMs: number) {
    const event = new Event('animationend', { bubbles: true });
    Object.defineProperties(event, {
        animationName: { value: animationName },
        elapsedTime: { value: elapsedMs / 1000 },
    });
    fireEvent(el, event);
}

afterEach(() => {
    vi.useRealTimers();
});

describe('Toast auto-dismiss (countdown bar in sync with dismissal)', () => {
    it('dismisses when the countdown bar animation reaches empty, even while Radix would keep its timer paused', () => {
        const onOpenChange = vi.fn();
        const { container } = renderToast({
            open: true,
            variant: 'destructive',
            duration: 6000,
            onOpenChange,
        });

        const bar = findBar(container);
        expect(bar).not.toBeNull();

        // Bar reaches empty -> must request close regardless of Radix's (pausable) timer.
        fireAnimationEnd(bar!, 'toast-progress', 6000);

        expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    it('ignores unrelated animationEnd events (e.g. enter/exit animations)', () => {
        const onOpenChange = vi.fn();
        const { container } = renderToast({
            open: true,
            variant: 'destructive',
            duration: 6000,
            onOpenChange,
        });

        const bar = findBar(container);
        fireAnimationEnd(bar!, 'slide-in-from-top-full', 6000);

        expect(onOpenChange).not.toHaveBeenCalled();
    });

    it('stays open when a reduced-motion stylesheet collapses the countdown, and closes on its own timer at the duration', () => {
        vi.useFakeTimers();
        const onOpenChange = vi.fn();
        const { container } = renderToast({
            open: true,
            variant: 'default',
            duration: 4000,
            onOpenChange,
        });

        // `animation-duration: 0.01ms !important` ends the bar at once.
        fireAnimationEnd(findBar(container)!, 'toast-progress', 0.01);
        expect(onOpenChange).not.toHaveBeenCalled();

        act(() => {
            vi.advanceTimersByTime(3900);
        });
        expect(onOpenChange).not.toHaveBeenCalled();

        act(() => {
            vi.advanceTimersByTime(200);
        });
        expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    it('persistent toasts render no countdown bar and cannot auto-dismiss', () => {
        const onOpenChange = vi.fn();
        const { container } = renderToast({
            open: true,
            variant: 'destructive',
            duration: 6000,
            persistent: true,
            onOpenChange,
        });

        expect(findBar(container)).toBeNull();
        expect(onOpenChange).not.toHaveBeenCalled();
    });
});
