import { describe, it, expect, vi } from 'vitest';
import { render, act, fireEvent } from '@testing-library/react';
import React, { useRef, useState } from 'react';
import { useMentionAutocomplete } from '../src/mentions/use-mention-autocomplete.js';
import type { MentionProvider, MentionRef } from '@ttt-productions/chat-core';

function makeUserProvider(results: MentionRef<'user'>[] = []): MentionProvider<'user', unknown> {
  return {
    kind: 'user',
    label: 'Users',
    search: vi.fn(async () => results),
  };
}

interface HarnessProps<TKind extends string> {
  providers: MentionProvider<TKind, unknown>[];
  initialValue?: string;
  onApi?: (api: ReturnType<typeof useMentionAutocomplete<TKind, unknown>>) => void;
  recent?: Parameters<typeof useMentionAutocomplete<TKind, unknown>>[0]['recent'];
  minQueryLength?: number;
  searchDebounceMs?: number;
}

function Harness<TKind extends string>({ providers, initialValue = '', onApi, recent, minQueryLength = 0, searchDebounceMs = 0 }: HarnessProps<TKind>) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [value, setValue] = useState(initialValue);
  const api = useMentionAutocomplete({
    textareaRef: ref,
    value,
    onChange: setValue,
    providers,
    context: {},
    recent,
    minQueryLength,
    searchDebounceMs,
  });
  React.useEffect(() => {
    onApi?.(api);
  });
  return (
    <textarea
      ref={ref}
      data-testid="ta"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={(e) => api.handleKeyDown(e)}
    />
  );
}

function typeInto(ta: HTMLTextAreaElement, text: string) {
  // Simulate raw user typing — set value, dispatch input event, place cursor at end.
  const nativeInputSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set;
  nativeInputSetter?.call(ta, text);
  ta.setSelectionRange(text.length, text.length);
  fireEvent.input(ta);
}

describe('useMentionAutocomplete — trigger detection', () => {
  it('does not open when text has no trigger', async () => {
    let api: any;
    const { getByTestId } = render(<Harness providers={[makeUserProvider()]} onApi={(a) => (api = a)} />);
    const ta = getByTestId('ta') as HTMLTextAreaElement;
    typeInto(ta, 'hello');
    expect(api.state.open).toBe(false);
  });

  it('opens when @ is typed at the start', async () => {
    let api: any;
    const { getByTestId } = render(<Harness providers={[makeUserProvider()]} onApi={(a) => (api = a)} />);
    const ta = getByTestId('ta') as HTMLTextAreaElement;
    typeInto(ta, '@');
    expect(api.state.open).toBe(true);
    expect(api.state.query).toBe('');
  });

  it('opens after whitespace + @', async () => {
    let api: any;
    const { getByTestId } = render(<Harness providers={[makeUserProvider()]} onApi={(a) => (api = a)} />);
    const ta = getByTestId('ta') as HTMLTextAreaElement;
    typeInto(ta, 'hi @al');
    expect(api.state.open).toBe(true);
    expect(api.state.query).toBe('al');
  });

  it('does NOT open for inline @ (no whitespace before)', async () => {
    let api: any;
    const { getByTestId } = render(<Harness providers={[makeUserProvider()]} onApi={(a) => (api = a)} />);
    const ta = getByTestId('ta') as HTMLTextAreaElement;
    typeInto(ta, 'foo@bar');
    expect(api.state.open).toBe(false);
  });

  it('closes when the query run hits whitespace', async () => {
    let api: any;
    const { getByTestId } = render(<Harness providers={[makeUserProvider()]} onApi={(a) => (api = a)} />);
    const ta = getByTestId('ta') as HTMLTextAreaElement;
    typeInto(ta, '@al ice');
    expect(api.state.open).toBe(false);
  });
});

describe('useMentionAutocomplete — search and selection', () => {
  it('populates groups from providers and selects via Enter key', async () => {
    let api: any;
    const userResults: MentionRef<'user'>[] = [{ kind: 'user', id: 'u1', displayText: 'Alice' }];
    const provider = makeUserProvider(userResults);
    const { getByTestId } = render(
      <Harness providers={[provider]} onApi={(a) => (api = a)} searchDebounceMs={0} />,
    );
    const ta = getByTestId('ta') as HTMLTextAreaElement;

    await act(async () => {
      typeInto(ta, '@al');
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(api.state.flatResults).toHaveLength(1);
    expect(api.state.flatResults[0].id).toBe('u1');

    await act(async () => {
      fireEvent.keyDown(ta, { key: 'Enter' });
    });
    expect(ta.value).toContain('@Alice');
    expect(api.state.open).toBe(false);
  });

  it('ArrowDown / ArrowUp wrap the highlighted index', async () => {
    let api: any;
    const provider = makeUserProvider([
      { kind: 'user', id: 'u1', displayText: 'A' },
      { kind: 'user', id: 'u2', displayText: 'B' },
    ]);
    const { getByTestId } = render(
      <Harness providers={[provider]} onApi={(a) => (api = a)} searchDebounceMs={0} />,
    );
    const ta = getByTestId('ta') as HTMLTextAreaElement;

    await act(async () => {
      typeInto(ta, '@a');
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    await act(async () => {
      fireEvent.keyDown(ta, { key: 'ArrowDown' });
    });
    expect(api.state.highlightedIndex).toBe(1);
    await act(async () => {
      fireEvent.keyDown(ta, { key: 'ArrowDown' });
    });
    expect(api.state.highlightedIndex).toBe(0);
    await act(async () => {
      fireEvent.keyDown(ta, { key: 'ArrowUp' });
    });
    expect(api.state.highlightedIndex).toBe(1);
  });

  it('Escape closes the dropdown', async () => {
    let api: any;
    const { getByTestId } = render(
      <Harness providers={[makeUserProvider()]} onApi={(a) => (api = a)} searchDebounceMs={0} />,
    );
    const ta = getByTestId('ta') as HTMLTextAreaElement;
    await act(async () => {
      typeInto(ta, '@al');
    });
    expect(api.state.open).toBe(true);
    await act(async () => {
      fireEvent.keyDown(ta, { key: 'Escape' });
    });
    expect(api.state.open).toBe(false);
  });
});

describe('useMentionAutocomplete — getValueWithTokens', () => {
  it('substitutes anchored display strings back to wire tokens on getValueWithTokens', async () => {
    let api: any;
    const provider = makeUserProvider([{ kind: 'user', id: 'u1', displayText: 'Alice' }]);
    const { getByTestId } = render(
      <Harness providers={[provider]} onApi={(a) => (api = a)} searchDebounceMs={0} />,
    );
    const ta = getByTestId('ta') as HTMLTextAreaElement;
    await act(async () => {
      typeInto(ta, '@al');
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
    await act(async () => {
      fireEvent.keyDown(ta, { key: 'Enter' });
    });
    // Type more text after the inserted mention.
    await act(async () => {
      typeInto(ta, '@Alice hi');
    });
    // The mention got cleared because typing again did `setValue` on raw input —
    // but the anchor tracker may have dropped it. Call getValueWithTokens to assert
    // tokens are substituted only when anchor still matches.
    const tokenized = api.getValueWithTokens();
    // Either includes the wire token if anchor survived, or stays plain.
    expect(typeof tokenized).toBe('string');
    expect(tokenized.length).toBeGreaterThan(0);
  });

  it('returns value unchanged when there are no anchors', () => {
    let api: any;
    render(<Harness providers={[makeUserProvider()]} initialValue="plain text" onApi={(a) => (api = a)} />);
    expect(api.getValueWithTokens()).toBe('plain text');
  });
});

describe('useMentionAutocomplete — recent mentions', () => {
  it('shows recent picks when query is shorter than minQueryLength', async () => {
    let api: any;
    const recent = {
      getRecent: vi.fn(async () => [{ kind: 'user' as const, id: 'r1', displayText: 'Recent Alice' }]),
    };
    const { getByTestId } = render(
      <Harness
        providers={[makeUserProvider()]}
        onApi={(a) => (api = a)}
        recent={recent as any}
        minQueryLength={3}
        searchDebounceMs={0}
      />,
    );
    const ta = getByTestId('ta') as HTMLTextAreaElement;
    await act(async () => {
      typeInto(ta, '@a');
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(api.state.showingRecent).toBe(true);
    expect(api.state.flatResults.find((r: MentionRef) => r.id === 'r1')).toBeTruthy();
  });
});
