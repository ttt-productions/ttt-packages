import { describe, it, expect, afterAll, afterEach, vi } from 'vitest';
import { createRef, type ReactElement, type Ref } from 'react';
import { act, render, screen } from '@testing-library/react';

// mobile-core reads the visual viewport once when it loads, so the fake is in place before the import.
const viewport = vi.hoisted(() => {
  class FakeVisualViewport extends EventTarget {
    width = 390;
    height = 800;
    offsetTop = 0;
    offsetLeft = 0;
    pageTop = 0;
    pageLeft = 0;
    scale = 1;
  }
  const fake = new FakeVisualViewport();
  Object.defineProperty(window, 'visualViewport', { configurable: true, value: fake });
  Object.defineProperty(window, 'innerHeight', { configurable: true, writable: true, value: 800 });
  return fake;
});

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '../src/react/components/dialog.js';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from '../src/react/components/alert-dialog.js';
import { ConsequenceDialog } from '../src/react/components/consequence-dialog.js';

function setViewport(height: number, offsetTop = 0) {
  act(() => {
    viewport.height = height;
    viewport.offsetTop = offsetTop;
    viewport.dispatchEvent(new Event('resize'));
  });
}

function RenameItemDialog({
  open,
  contentRef,
}: {
  open: boolean;
  contentRef?: Ref<HTMLDivElement>;
}) {
  return (
    <Dialog open={open}>
      <DialogContent ref={contentRef} style={{ zIndex: 60 }}>
        <DialogTitle>Rename item</DialogTitle>
        <DialogDescription>Name the item.</DialogDescription>
        <input aria-label="Item name" />
      </DialogContent>
    </Dialog>
  );
}

type ViewportListener = [string, EventListenerOrEventListenerObject | null];

function viewportListenerCalls(spy: { mock: { calls: unknown[][] } }): ViewportListener[] {
  return spy.mock.calls
    .map((call) => call as ViewportListener)
    .filter(([type]) => type === 'resize' || type === 'scroll');
}

function expectViewportListenersOnlyWhileOpen(view: (open: boolean) => ReactElement) {
  const added = vi.spyOn(viewport, 'addEventListener');
  const removed = vi.spyOn(viewport, 'removeEventListener');
  const { rerender } = render(view(false));
  expect(viewportListenerCalls(added)).toEqual([]);

  rerender(view(true));
  const listeners = viewportListenerCalls(added);
  expect(listeners.length).toBeGreaterThan(0);

  rerender(view(false));
  const released = viewportListenerCalls(removed);
  for (const [type, handler] of listeners) {
    expect(released).toContainEqual([type, handler]);
  }
}

afterEach(() => {
  setViewport(800);
  vi.restoreAllMocks();
});

afterAll(() => {
  delete (window as { visualViewport?: unknown }).visualViewport;
});

describe('DialogContent and the phone keyboard', () => {
  it('keeps the centred layout capped at 90vh while no keyboard is open', () => {
    render(<RenameItemDialog open />);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveClass(
      'top-[50%]',
      'translate-y-[-50%]',
      'max-h-[90vh]',
      'overflow-y-auto',
    );
    expect(dialog.style.top).toBe('');
    expect(dialog.style.maxHeight).toBe('');
    expect(dialog.style.zIndex).toBe('60');
  });

  it('fits itself to the visible area above an open keyboard and lets its content scroll', () => {
    render(<RenameItemDialog open />);
    const dialog = screen.getByRole('dialog');

    setViewport(450, 120);

    expect(dialog.style.top).toBe(`${120 + 450 / 2}px`);
    expect(dialog.style.maxHeight).toBe(`${450 - 2 * 8}px`);
    expect(dialog.style.overflowY).toBe('auto');
    expect(dialog.style.zIndex).toBe('60');
  });

  it('returns to its centred layout when the keyboard closes', () => {
    render(<RenameItemDialog open />);
    const dialog = screen.getByRole('dialog');

    setViewport(450, 120);
    setViewport(800);

    expect(dialog.style.top).toBe('');
    expect(dialog.style.maxHeight).toBe('');
  });

  it('keeps the focused field in view inside the dialog while the keyboard is open', () => {
    render(<RenameItemDialog open />);
    const dialog = screen.getByRole('dialog');
    const field = screen.getByLabelText('Item name');
    dialog.getBoundingClientRect = () =>
      DOMRect.fromRect({ x: 0, y: 100, width: 300, height: 300 });
    field.getBoundingClientRect = () => DOMRect.fromRect({ x: 0, y: 420, width: 300, height: 40 });
    dialog.scrollTop = 0;

    setViewport(450, 0);
    act(() => field.focus());

    expect(dialog.scrollTop).toBe(460 - (400 - 8));
  });

  it('still hands its content element to a ref the caller passes', () => {
    const contentRef = createRef<HTMLDivElement>();
    render(<RenameItemDialog open contentRef={contentRef} />);
    expect(contentRef.current).toBe(screen.getByRole('dialog'));
  });

  it('listens to the visual viewport only while it is open', () => {
    expectViewportListenersOnlyWhileOpen((open) => <RenameItemDialog open={open} />);
  });
});

function DeleteItemAlert({
  open,
  contentRef,
}: {
  open: boolean;
  contentRef?: Ref<HTMLDivElement>;
}) {
  return (
    <AlertDialog open={open}>
      <AlertDialogContent ref={contentRef} style={{ zIndex: 60 }}>
        <AlertDialogTitle>Delete item</AlertDialogTitle>
        <AlertDialogDescription>Type the name to confirm.</AlertDialogDescription>
        <input aria-label="Item to delete" />
      </AlertDialogContent>
    </AlertDialog>
  );
}

describe('AlertDialogContent and the phone keyboard', () => {
  it('keeps its centred layout and adds no style while no keyboard is open', () => {
    render(<DeleteItemAlert open />);
    const dialog = screen.getByRole('alertdialog');
    expect(dialog).toHaveClass('top-[50%]', 'translate-y-[-50%]');
    expect(dialog.style.top).toBe('');
    expect(dialog.style.maxHeight).toBe('');
    expect(dialog.style.zIndex).toBe('60');
  });

  it('fits itself to the visible area above an open keyboard and returns when it closes', () => {
    render(<DeleteItemAlert open />);
    const dialog = screen.getByRole('alertdialog');

    setViewport(450, 120);
    expect(dialog.style.top).toBe(`${120 + 450 / 2}px`);
    expect(dialog.style.maxHeight).toBe(`${450 - 2 * 8}px`);
    expect(dialog.style.overflowY).toBe('auto');
    expect(dialog.style.zIndex).toBe('60');

    setViewport(800);
    expect(dialog.style.top).toBe('');
    expect(dialog.style.maxHeight).toBe('');
  });

  it('keeps the focused field in view inside the alert dialog while the keyboard is open', () => {
    render(<DeleteItemAlert open />);
    const dialog = screen.getByRole('alertdialog');
    const field = screen.getByLabelText('Item to delete');
    dialog.getBoundingClientRect = () =>
      DOMRect.fromRect({ x: 0, y: 100, width: 300, height: 300 });
    field.getBoundingClientRect = () => DOMRect.fromRect({ x: 0, y: 420, width: 300, height: 40 });
    dialog.scrollTop = 0;

    setViewport(450, 0);
    act(() => field.focus());

    expect(dialog.scrollTop).toBe(460 - (400 - 8));
  });

  it('still hands its content element to a ref the caller passes', () => {
    const contentRef = createRef<HTMLDivElement>();
    render(<DeleteItemAlert open contentRef={contentRef} />);
    expect(contentRef.current).toBe(screen.getByRole('alertdialog'));
  });

  it('listens to the visual viewport only while it is open', () => {
    expectViewportListenersOnlyWhileOpen((open) => <DeleteItemAlert open={open} />);
  });
});

describe('ConsequenceDialog and the phone keyboard', () => {
  it('fits a confirmation with a typed field above an open keyboard', () => {
    render(
      <ConsequenceDialog
        open
        title="Delete item"
        immediateEffect="The item is deleted."
        typedConfirmation={{ phrase: 'DELETE' }}
        confirmLabel="Delete"
        destructive
        onConfirm={() => undefined}
      />,
    );
    const dialog = screen.getByRole('alertdialog');
    expect(dialog.style.top).toBe('');

    setViewport(450, 120);

    expect(dialog.style.top).toBe(`${120 + 450 / 2}px`);
    expect(dialog.style.maxHeight).toBe(`${450 - 2 * 8}px`);
  });
});
