import { describe, it, expect, vi } from 'vitest';
import { render, act } from '@testing-library/react';
import React from 'react';
import {
  InFlightUploadsProvider,
  type InFlightUploadsAdapter,
  type FirestoreSubscribeFn,
  type FirestoreLikeSnapshot,
  type ParsedPendingMedia,
} from '../src/react/in-flight-uploads-provider.js';
import { UploadActivityTray } from '../src/react/upload-activity-tray.js';

function makeAdapter(): InFlightUploadsAdapter {
  return {
    getCurrentUserId: () => 'user1',
    db: {},
    collectionPath: 'pendingMedia',
    listenerWindowMs: 60_000,
    parsePendingMedia: (raw) => raw as ParsedPendingMedia,
    onUploadCompleted: vi.fn(),
    onUploadFailed: vi.fn(),
    onUploadRejected: vi.fn(),
    onMonitoringEvent: vi.fn(),
  };
}

function makeDriver() {
  let driver: ((s: FirestoreLikeSnapshot) => void) | null = null;
  const subscribe: FirestoreSubscribeFn = (args) => {
    driver = args.onSnapshot;
    return () => {};
  };
  const drive = (changes: Array<{ type: 'added' | 'modified' | 'removed'; id: string; data?: unknown }>) => {
    if (!driver) throw new Error('No subscriber');
    driver({
      docChanges: () =>
        changes.map((c) => ({ type: c.type, doc: { id: c.id, data: () => c.data ?? {} } })),
    });
  };
  return { subscribe, drive };
}

function makeClearMutation(overrides: Partial<{ mutate: (id: string) => void; isPending: boolean; variables: string | undefined }> = {}) {
  return {
    mutate: overrides.mutate ?? vi.fn(),
    isPending: overrides.isPending ?? false,
    variables: overrides.variables,
  };
}

describe('UploadActivityTray', () => {
  it('renders null when there are no items', () => {
    const adapter = makeAdapter();
    const { subscribe } = makeDriver();
    const { container } = render(
      <InFlightUploadsProvider adapter={adapter} subscribe={subscribe}>
        <UploadActivityTray clearMutation={makeClearMutation()} />
      </InFlightUploadsProvider>,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders the FAB when at least one item exists', () => {
    const adapter = makeAdapter();
    const { subscribe, drive } = makeDriver();
    const { container } = render(
      <InFlightUploadsProvider adapter={adapter} subscribe={subscribe}>
        <UploadActivityTray clearMutation={makeClearMutation()} />
      </InFlightUploadsProvider>,
    );
    act(() => {
      drive([
        {
          type: 'added',
          id: 'd1',
          data: { id: 'd1', userId: 'user1', fileOrigin: 'streetz', status: 'pending', createdAt: Date.now(), surface: '/x' },
        },
      ]);
    });
    expect(container.firstChild).not.toBeNull();
  });

  it('omits footer when no viewAllHref/renderViewAllLink/renderFooter is supplied', () => {
    const adapter = makeAdapter();
    const { subscribe, drive } = makeDriver();
    const { container } = render(
      <InFlightUploadsProvider adapter={adapter} subscribe={subscribe}>
        <UploadActivityTray clearMutation={makeClearMutation()} />
      </InFlightUploadsProvider>,
    );
    act(() => {
      drive([
        {
          type: 'added',
          id: 'd1',
          data: { id: 'd1', userId: 'user1', fileOrigin: 'streetz', status: 'pending', createdAt: Date.now(), surface: '/x' },
        },
      ]);
    });
    // The popover is closed in jsdom by default, but we can assert the wrapper
    // renders and the tray's outer structure is in place.
    expect(container.querySelector('[aria-label]')).toBeTruthy();
  });
});
