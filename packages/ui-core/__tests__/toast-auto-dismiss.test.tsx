import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { Toast, ToastProvider, ToastViewport, ToastTitle } from '../src/react/components/toast';

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

function fireAnimationEnd(el: HTMLElement, animationName: string) {
    fireEvent.animationEnd(el, { animationName });
}

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
        fireAnimationEnd(bar!, 'toast-progress');

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
        fireAnimationEnd(bar!, 'slide-in-from-top-full');

        expect(onOpenChange).not.toHaveBeenCalled();
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
