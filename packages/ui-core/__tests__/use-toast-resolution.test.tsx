import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { toast, useToast } from '../src/react/hooks/use-toast';

// Each test resets toast state by dismissing everything from the previous one.
function clearAllToasts() {
    const { result } = renderHook(() => useToast());
    act(() => {
        result.current.dismiss();
    });
}

describe('toast() duration resolution', () => {
    beforeEach(() => {
        clearAllToasts();
    });

    it('default variant resolves to 4000ms', () => {
        const { result } = renderHook(() => useToast());
        act(() => {
            toast({ title: 'Default toast' });
        });
        const t = result.current.toasts.find((x) => x.title === 'Default toast');
        expect(t?.duration).toBe(4000);
    });

    it('success variant resolves to 3000ms', () => {
        const { result } = renderHook(() => useToast());
        act(() => {
            toast({ title: 'Success toast', variant: 'success' });
        });
        const t = result.current.toasts.find((x) => x.title === 'Success toast');
        expect(t?.duration).toBe(3000);
    });

    it('warning variant resolves to 5000ms', () => {
        const { result } = renderHook(() => useToast());
        act(() => {
            toast({ title: 'Warning toast', variant: 'warning' });
        });
        const t = result.current.toasts.find((x) => x.title === 'Warning toast');
        expect(t?.duration).toBe(5000);
    });

    it('destructive variant resolves to 6000ms', () => {
        const { result } = renderHook(() => useToast());
        act(() => {
            toast({ title: 'Destructive toast', variant: 'destructive' });
        });
        const t = result.current.toasts.find((x) => x.title === 'Destructive toast');
        expect(t?.duration).toBe(6000);
    });

    it('error variant resolves to 6000ms (same as destructive)', () => {
        const { result } = renderHook(() => useToast());
        act(() => {
            toast({ title: 'Error toast', variant: 'error' });
        });
        const t = result.current.toasts.find((x) => x.title === 'Error toast');
        expect(t?.duration).toBe(6000);
    });

    it('explicit duration overrides the variant default', () => {
        const { result } = renderHook(() => useToast());
        act(() => {
            toast({ title: 'Custom duration toast', variant: 'success', duration: 9999 });
        });
        const t = result.current.toasts.find((x) => x.title === 'Custom duration toast');
        expect(t?.duration).toBe(9999);
    });
});

describe('toast() persistent option', () => {
    beforeEach(() => {
        clearAllToasts();
    });

    it('resolves duration to Infinity when persistent: true', () => {
        const { result } = renderHook(() => useToast());
        act(() => {
            toast({ title: 'Persistent toast', persistent: true });
        });
        const t = result.current.toasts.find((x) => x.title === 'Persistent toast');
        expect(t?.duration).toBe(Infinity);
        expect(t?.persistent).toBe(true);
    });

    it('persistent: true overrides explicit duration', () => {
        const { result } = renderHook(() => useToast());
        act(() => {
            toast({ title: 'Persistent override toast', persistent: true, duration: 1234 });
        });
        const t = result.current.toasts.find((x) => x.title === 'Persistent override toast');
        // Persistent wins — duration is ignored.
        expect(t?.duration).toBe(Infinity);
    });

    it('persistent: true overrides the variant default', () => {
        const { result } = renderHook(() => useToast());
        act(() => {
            toast({ title: 'Persistent variant toast', variant: 'success', persistent: true });
        });
        const t = result.current.toasts.find((x) => x.title === 'Persistent variant toast');
        // Persistent wins over the 3000ms success default.
        expect(t?.duration).toBe(Infinity);
    });

    it('persistent: false falls through to the variant default', () => {
        const { result } = renderHook(() => useToast());
        act(() => {
            toast({ title: 'Non-persistent toast', variant: 'warning', persistent: false });
        });
        const t = result.current.toasts.find((x) => x.title === 'Non-persistent toast');
        expect(t?.duration).toBe(5000);
    });
});
