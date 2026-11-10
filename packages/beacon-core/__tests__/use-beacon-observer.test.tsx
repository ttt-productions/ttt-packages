import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';

const store = await vi.hoisted(async () => {
  const { makeInMemoryClientFirestore } =
    await import('@ttt-productions/firebase-helpers/firestore-client/testing');
  return makeInMemoryClientFirestore();
});

vi.mock(import('firebase/firestore'), async (importOriginal) => {
  const { clientFirestoreFake } = await import('../../../test/client-firestore-fake.js');
  return clientFirestoreFake(importOriginal, store);
});

import {
  firestoreError,
  type ExecutedClientRead,
} from '@ttt-productions/firebase-helpers/firestore-client/testing';
import { firestoreTestWrapper } from '@ttt-productions/query-core/react/testing';
import { useBeaconObserver } from '../src/react/use-beacon-observer.js';
import type { BeaconObserverOptions } from '../src/react/use-beacon-observer.js';

type PageStamp = { updatedAt: number; changeId?: string; section: string };
type Options = BeaconObserverOptions<PageStamp>;
type OnChange = Options['onChange'];

const PAGE_1 = 'signals/page1';
const PAGE_2 = 'signals/page2';
const keyOf = (path: string) => ['signal', path] as const;
const listensTo = (path: string) => (read: ExecutedClientRead) => read.listen && read.path === path;

const stamp = (changeId: string, section = 'list', updatedAt = 100) => ({
  updatedAt,
  changeId,
  section,
});

function observe(initial: Partial<Options> = {}) {
  const onChange = vi.fn<OnChange>();
  const wrapper = firestoreTestWrapper(store.db);
  const view = renderHook(
    (props: Partial<Options>) =>
      useBeaconObserver<PageStamp>({
        docPath: PAGE_1,
        queryKey: keyOf(props.docPath ?? PAGE_1),
        reportFirstLoad: false,
        onChange,
        ...props,
      }),
    { wrapper: wrapper.Wrapper, initialProps: initial },
  );
  const seen = (path = PAGE_1) => wrapper.queryClient.getQueryData(keyOf(path));
  const answered = (changeId: string, path = PAGE_1) =>
    waitFor(() => expect(seen(path)).toMatchObject({ changeId }));
  return { onChange, view, wrapper, seen, answered };
}

beforeEach(() => {
  store.reset();
});

describe('useBeaconObserver', () => {
  it("holds one listener on the beacon document, under the app's query key", async () => {
    store.seed(PAGE_1, stamp('a'));
    const { answered, wrapper } = observe();
    await answered('a');

    expect(store.queries()).toHaveLength(1);
    expect(store.queries()[0]).toMatchObject({ kind: 'doc', listen: true, path: PAGE_1 });
    expect(wrapper.queryClient.getQueryCache().find({ queryKey: keyOf(PAGE_1) })).toBeDefined();
  });

  it("reports a moved change id with the stamp's fields, and nothing for the first load", async () => {
    store.seed(PAGE_1, stamp('a'));
    const { onChange, answered } = observe();
    await answered('a');
    expect(onChange).not.toHaveBeenCalled();

    act(() => store.seed(PAGE_1, stamp('b', 'summary', 200)));
    await waitFor(() => expect(onChange).toHaveBeenCalledTimes(1));
    expect(onChange).toHaveBeenCalledWith({
      id: 'page1',
      updatedAt: 200,
      changeId: 'b',
      section: 'summary',
    });
  });

  it('reports a commit that landed later with an older time, and one in the same millisecond', async () => {
    store.seed(PAGE_1, stamp('b', 'list', 200));
    const { onChange, answered } = observe();
    await answered('b');

    act(() => store.seed(PAGE_1, stamp('a', 'list', 100)));
    await waitFor(() => expect(onChange).toHaveBeenCalledTimes(1));

    act(() => store.seed(PAGE_1, stamp('c', 'list', 100)));
    await waitFor(() => expect(onChange).toHaveBeenCalledTimes(2));
  });

  it('never reports the same change id again, whatever else in the document changes', async () => {
    store.seed(PAGE_1, stamp('a', 'list', 100));
    const { onChange, seen, answered } = observe();
    await answered('a');

    act(() => store.seed(PAGE_1, stamp('a', 'summary', 150)));
    await waitFor(() => expect(seen()).toMatchObject({ updatedAt: 150 }));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('reports the first live snapshot when the app asks for a first load to report', async () => {
    store.seed(PAGE_1, stamp('a'));
    const { onChange } = observe({ reportFirstLoad: true });

    await waitFor(() => expect(onChange).toHaveBeenCalledTimes(1));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ changeId: 'a' }));
  });

  it('reports a first load of a missing document as no stamp', async () => {
    const { onChange } = observe({ reportFirstLoad: true });

    await waitFor(() => expect(onChange).toHaveBeenCalledTimes(1));
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('reports the first stamp written where there was no document', async () => {
    const { onChange, seen } = observe();
    await waitFor(() => expect(seen()).toBeNull());

    act(() => store.seed(PAGE_1, stamp('a')));
    await waitFor(() => expect(onChange).toHaveBeenCalledTimes(1));
  });

  it('reports a stamp with an id replacing a document stored without one', async () => {
    store.seed(PAGE_1, { updatedAt: 100, section: 'list' });
    const { onChange, seen } = observe();
    await waitFor(() => expect(seen()).toMatchObject({ updatedAt: 100 }));
    expect(onChange).not.toHaveBeenCalled();

    act(() => store.seed(PAGE_1, stamp('a')));
    await waitFor(() => expect(onChange).toHaveBeenCalledTimes(1));
  });

  it('takes nothing answered from cache as seen: the server confirming a moved id reports it', async () => {
    store.seed(PAGE_1, stamp('a'));
    const { onChange, answered } = observe();
    await answered('a');

    act(() => store.answerFromCache(listensTo(PAGE_1)));
    act(() => store.seed(PAGE_1, stamp('b')));
    await answered('b');
    expect(onChange).not.toHaveBeenCalled();

    act(() => store.answerFromServer(listensTo(PAGE_1)));
    await waitFor(() => expect(onChange).toHaveBeenCalledTimes(1));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ changeId: 'b' }));
  });

  it('reports nothing when the listener comes back to the id it last saw live', async () => {
    store.seed(PAGE_1, stamp('a'));
    const { onChange, answered } = observe();
    await answered('a');

    act(() => store.answerFromCache(listensTo(PAGE_1)));
    act(() => store.answerFromServer(listensTo(PAGE_1)));
    act(() => store.seed(PAGE_1, stamp('b')));
    await waitFor(() => expect(onChange).toHaveBeenCalledTimes(1));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ changeId: 'b' }));
  });

  it('reports nothing for a listener that fails, and adds no capture of its own', async () => {
    const reported = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    store.seed(PAGE_1, stamp('a'));
    const { onChange, answered } = observe({ reportFirstLoad: true });
    await answered('a');
    onChange.mockClear();

    await act(async () =>
      store.failListeners(listensTo(PAGE_1), firestoreError('unavailable', 'unavailable')),
    );
    expect(reported).toHaveBeenCalledWith(
      expect.stringContaining('Subscription error'),
      expect.objectContaining({ code: 'unavailable' }),
    );
    expect(onChange).not.toHaveBeenCalled();
    reported.mockRestore();
  });

  it('opens no listener while it is not enabled', () => {
    store.seed(PAGE_1, stamp('a'));
    const { onChange } = observe({ enabled: false, reportFirstLoad: true });

    expect(store.liveListeners()).toBe(0);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("starts fresh on another document: its first stamp is that page's baseline, never a move", async () => {
    store.seed(PAGE_1, stamp('a'));
    store.seed(PAGE_2, stamp('z'));
    const { onChange, view, answered } = observe();
    await answered('a');

    view.rerender({ docPath: PAGE_2 });
    await answered('z', PAGE_2);
    expect(onChange).not.toHaveBeenCalled();

    act(() => store.seed(PAGE_2, stamp('y')));
    await waitFor(() => expect(onChange).toHaveBeenCalledTimes(1));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ id: 'page2', changeId: 'y' }));
  });

  it('gives two observers of one beacon one listener, and each its own report', async () => {
    store.seed(PAGE_1, stamp('a'));
    const first = observe();
    await first.answered('a');
    const onSecond = vi.fn<OnChange>();
    renderHook(
      () =>
        useBeaconObserver<PageStamp>({
          docPath: PAGE_1,
          queryKey: keyOf(PAGE_1),
          reportFirstLoad: false,
          onChange: onSecond,
        }),
      { wrapper: first.wrapper.Wrapper },
    );
    expect(store.liveListeners()).toBe(1);

    act(() => store.seed(PAGE_1, stamp('b')));
    await waitFor(() => expect(first.onChange).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(onSecond).toHaveBeenCalledTimes(1));
  });
});
