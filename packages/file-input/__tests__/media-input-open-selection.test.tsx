import * as React from 'react';
import { render, act, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { MediaOriginSpec } from '@ttt-productions/media-schemas';
import { MediaInput } from '../src/react/components/media-input';
import type { MediaInputHandle } from '../src/types';

// The imperative `openSelection()` handle must activate the SAME trigger
// semantics as a human click — single enabled action runs directly through the
// canonical selection path (honoring onBeforeSelect / validation / crop), and it
// must never open anything while disabled or loading. A hidden-input shortcut is
// forbidden, so we assert on the canonical picker click, not the raw input.

// Radix's controlled dropdown mounts its portal content when opened; stub the
// browser APIs jsdom lacks so a multi-action open doesn't throw.
function installDomStubs() {
  if (typeof globalThis.ResizeObserver === 'undefined') {
    (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
  Element.prototype.scrollIntoView = vi.fn();
  if (!('hasPointerCapture' in Element.prototype)) {
    (Element.prototype as unknown as { hasPointerCapture: () => boolean }).hasPointerCapture = () => false;
  }
  if (!('setPointerCapture' in Element.prototype)) {
    (Element.prototype as unknown as { setPointerCapture: () => void }).setPointerCapture = () => {};
  }
  if (!('releasePointerCapture' in Element.prototype)) {
    (Element.prototype as unknown as { releasePointerCapture: () => void }).releasePointerCapture = () => {};
  }
}

/** Single enabled action (choose file) → the plain button path. */
function pickOnlySpec(): MediaOriginSpec {
  return {
    kind: 'image',
    accept: { kinds: ['image'], mimes: ['image/png'] },
    client: { allowPick: true, allowCapturePhoto: false, allowRecordVideo: false, allowRecordAudio: false },
  };
}

/** Two enabled actions (choose file + take photo) → the dropdown path. */
function pickAndPhotoSpec(): MediaOriginSpec {
  return {
    kind: 'image',
    accept: { kinds: ['image'], mimes: ['image/png'] },
    client: { allowPick: true, allowCapturePhoto: true, allowRecordVideo: false, allowRecordAudio: false },
  };
}

function renderInput(extra: Partial<React.ComponentProps<typeof MediaInput>> = {}, spec = pickOnlySpec()) {
  const ref = React.createRef<MediaInputHandle>();
  const utils = render(<MediaInput ref={ref} spec={spec} onChange={vi.fn()} {...extra} />);
  const input = utils.container.querySelector('input[type="file"]') as HTMLInputElement;
  const clickSpy = vi.spyOn(input, 'click').mockImplementation(() => {});
  return { ref, clickSpy, ...utils };
}

beforeEach(() => {
  installDomStubs();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('MediaInput.openSelection — single-action canonical path', () => {
  it('opens the canonical picker exactly once', async () => {
    const { ref, clickSpy } = renderInput();
    await act(async () => {
      ref.current!.openSelection();
    });
    expect(clickSpy).toHaveBeenCalledTimes(1);
  });

  it('runs onBeforeSelect before opening, and opens when it resolves true', async () => {
    const onBeforeSelect = vi.fn().mockResolvedValue(true);
    const { ref, clickSpy } = renderInput({ onBeforeSelect });
    await act(async () => {
      ref.current!.openSelection();
    });
    expect(onBeforeSelect).toHaveBeenCalledTimes(1);
    expect(clickSpy).toHaveBeenCalledTimes(1);
  });

  it('does NOT open the picker when onBeforeSelect resolves false', async () => {
    const onBeforeSelect = vi.fn().mockResolvedValue(false);
    const { ref, clickSpy } = renderInput({ onBeforeSelect });
    await act(async () => {
      ref.current!.openSelection();
    });
    expect(onBeforeSelect).toHaveBeenCalledTimes(1);
    expect(clickSpy).not.toHaveBeenCalled();
  });

  it('is a no-op while disabled (never opens, never runs onBeforeSelect)', async () => {
    const onBeforeSelect = vi.fn().mockResolvedValue(true);
    const { ref, clickSpy } = renderInput({ disabled: true, onBeforeSelect });
    await act(async () => {
      ref.current!.openSelection();
    });
    expect(onBeforeSelect).not.toHaveBeenCalled();
    expect(clickSpy).not.toHaveBeenCalled();
  });

  it('is a no-op while loading (never opens, never runs onBeforeSelect)', async () => {
    const onBeforeSelect = vi.fn().mockResolvedValue(true);
    const { ref, clickSpy } = renderInput({
      isLoading: true,
      uploadState: { phase: 'uploading', percent: 40 },
      onBeforeSelect,
    });
    await act(async () => {
      ref.current!.openSelection();
    });
    expect(onBeforeSelect).not.toHaveBeenCalled();
    expect(clickSpy).not.toHaveBeenCalled();
  });
});

describe('MediaInput.openSelection — multi-action dropdown path', () => {
  it('opens the choice dropdown instead of running an action directly', async () => {
    const onBeforeSelect = vi.fn().mockResolvedValue(true);
    const { ref, clickSpy, getByRole } = renderInput({ onBeforeSelect }, pickAndPhotoSpec());
    const trigger = getByRole('button', { name: /add media/i });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');

    await act(async () => {
      ref.current!.openSelection();
    });

    // Menu opened — but no action ran yet, so neither the picker nor the guard fired.
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(clickSpy).not.toHaveBeenCalled();
    expect(onBeforeSelect).not.toHaveBeenCalled();
  });
});
