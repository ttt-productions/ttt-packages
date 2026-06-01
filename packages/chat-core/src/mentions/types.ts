/**
 * Generic mention system types.
 *
 * chat-core owns the mention infrastructure (parsing, autocomplete UI, keyboard
 * behavior, composer insertion, message text rendering) but knows nothing about
 * what a "user" or "entity" is. The consumer parameterizes `TKind` to its own
 * union and supplies one `MentionProvider` per kind.
 *
 * Wire format â€” mentions are encoded inline in the message's `text` field as
 * `@[kind:id|displayText]` tokens. The renderer parses them out at display
 * time. No schema change to ChatMessage.
 *
 * These are the PURE mention contracts. The React-coupled render type for
 * autocomplete rows (`renderResult`) lives in @ttt-productions/chat-react.
 */

/**
 * Resolved mention â€” the value that ends up in the wire token after the user
 * selects an autocomplete result.
 *
 * `kind` is the discriminator supplied by the consumer (e.g. `'member'`, `'tag'`); `id` is the
 * consumer-chosen stable identifier; `displayText` is the user-facing label
 * (typically a display name or title).
 */
export type MentionRef<TKind extends string = string> = {
  kind: TKind;
  id: string;
  displayText: string;
};

/**
 * Single segment in parsed message text. Either a literal text run or a
 * resolved mention. The renderer walks an ordered array of these.
 */
export type ParsedSegment<TKind extends string = string> =
  | { type: 'text'; text: string }
  | { type: 'mention'; ref: MentionRef<TKind> };

/**
 * Provider supplying autocomplete results for one mention kind.
 *
 * - `kind` â€” the discriminator. Must match `MentionRef.kind` for results
 *   returned by `search`.
 * - `label` â€” human-readable label for the section / tab.
 * - `search` â€” async query. Receives the current query string (after the
 *   trigger character), the consumer-supplied `context`, and an optional
 *   `signal` for cancellation. Returns up to whatever limit the provider
 *   chooses; the chat UI renders all returned results.
 *
 * `TContext` is consumer-owned â€” pass anything you need inside `search`
 * (Firestore db, current user id, surface-specific filters). The mention
 * system never inspects it.
 *
 * Optional per-row custom rendering (`renderResult`) is a React concern and is
 * layered on top of this pure provider by `RenderableMentionProvider` in
 * @ttt-productions/chat-react.
 */
export type MentionProvider<TKind extends string = string, TContext = unknown> = {
  kind: TKind;
  label: string;
  search: (args: {
    query: string;
    context: TContext;
    signal?: AbortSignal;
  }) => Promise<MentionRef<TKind>[]>;
};

/**
 * Optional recent-mentions adapter. When provided, the autocomplete UI shows
 * recent picks when the user opens the dropdown without typing a query
 * (or after typing fewer than the configured minimum characters).
 *
 * `getRecent` MAY be async â€” the autocomplete renders a spinner while it
 * resolves. `recordUse` is fired after a successful selection so consumers
 * can persist usage.
 */
export type RecentMentionsAdapter<TKind extends string = string> = {
  getRecent: () => MentionRef<TKind>[] | Promise<MentionRef<TKind>[]>;
  recordUse?: (ref: MentionRef<TKind>) => void | Promise<void>;
};

/**
 * Anchor describing the position of an inserted mention inside the composer's
 * text buffer. Tracked in component state so positionally-collocated mentions
 * with the same display string disambiguate on send.
 *
 * - `start` / `end` â€” character offsets into the current textarea value.
 * - `ref` â€” the resolved MentionRef.
 */
export type MentionAnchor<TKind extends string = string> = {
  start: number;
  end: number;
  ref: MentionRef<TKind>;
};
