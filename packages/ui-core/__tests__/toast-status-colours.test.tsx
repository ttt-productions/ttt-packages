import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { Toast, ToastProvider, ToastViewport, ToastTitle } from '../src/react/components/toast';

// A solid status fill carries ITS OWN status foreground, and no other text colour at rest:
// each toast variant reads its fill, text, and edge from one --toast-<family> set.
const TEXT_NOT_A_COLOUR = /^text-(xs|sm|base|lg|\d*xl|left|center|right|justify|start|end|wrap|nowrap|balance|pretty|ellipsis|clip)$/;
const restingTextColours = (classes: string) =>
    classes.split(/\s+/).filter((c) => c.startsWith('text-') && !TEXT_NOT_A_COLOUR.test(c));

function renderToastRoot(variant: 'destructive' | 'success' | 'warning' | 'error'): HTMLElement {
    const { container } = render(
        <ToastProvider>
            <Toast open variant={variant} persistent>
                <ToastTitle>Body</ToastTitle>
            </Toast>
            <ToastViewport />
        </ToastProvider>,
    );
    const root = container.querySelector<HTMLElement>(`[data-variant="${variant}"]`);
    expect(root).not.toBeNull();
    return root!;
}

describe('Toast — a status fill carries its own status foreground', () => {
    const cases = [
        { variant: 'success', family: 'toast-success' },
        { variant: 'warning', family: 'toast-warning' },
        { variant: 'destructive', family: 'toast-destructive' },
        { variant: 'error', family: 'toast-destructive' },
    ] as const;

    for (const { variant, family } of cases) {
        it(`variant="${variant}" pairs --${family} with --${family}-foreground and no other text colour`, () => {
            const root = renderToastRoot(variant);
            expect(root).toHaveClass(`bg-[color:var(--${family})]`);
            expect(restingTextColours(root.className)).toEqual([`text-[color:var(--${family}-foreground)]`]);
        });
    }
});
