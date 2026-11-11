# Adopt @ttt-productions/ui-core 0.11.45

**What:** `ClippedText` clips in the caller's own box (`as` for a plain tag, `asChild` for a component) and can show a copy control; ui-core gains `InlineName`, `MachineText` and `CopyButton`; the return scroll stores under the app's whole key, through storage-core.
**Severity:** medium

- **Package and version:** `@ttt-productions/ui-core` 0.11.45.
- **Release:** `./scripts/release-multiple.sh dev-standards storage-core firebase-helpers
  ui-core repo-guards theme-core consent-core query-core app-config-core notification-core
  sweep-core auth-core q-core media-viewer file-input upload-core patch`.
- **What changed:**
  - `ClippedText` takes `as`, naming the plain tag it renders (`span` by default; a heading, `p`,
    `div`, `li`, `dt`, `dd`, `td`, `th`, `caption`, `figcaption`, `strong`, `em`, `small`, `a`,
    `button`, `label`, `legend`), with that tag's own props. That element is the clipped box, with
    the text straight inside it, so it clips to its own width. `asChild` stays, for a component only
    (a link component, a card title). New types: `ClippedTextTag`, `ClippedTextCopyTag`; `copy`
    takes `CopyButtonWording`, the copy control's own wording type.
  - `ClippedText`'s `copy` (off by default) shows the copy control after the text and copies the
    full `text`. It takes the control's `title` and toast wording, and is offered only where the
    element may hold a button beside text — never on a heading, a link, a button, a label, a legend
    or an `asChild` component.
  - `InlineName({ name })`: a name inside a sentence as plain inline text that wraps with the
    sentence and breaks mid-word where it has no space; never cut, no tooltip, no marks.
  - `MachineText({ text, as | asChild })`: an id, an email, a hash or a file name that breaks at
    any character and never clips. `as` names a plain tag (`span`, `code`, `p`, `div`, `li`, `dd`,
    `td`, `pre`); `asChild` puts the break on one component child (a card title), keeping its props.
  - `CopyButton({ value, title, copiedToast, failedToast })` (with `CopyButtonProps`,
    `CopyButtonWording`, `CopyToast`; both toasts required, and `ClippedText`'s `copy` requires both
    too): the one copy control. It writes the clipboard, swaps its icon to a check while the copy is
    fresh, always shows the app's `copiedToast` on success and `failedToast` on failure,
    is named "Copy <title>" for a screen reader, is pending while the write runs, and never submits
    a form.
  - `SelectItem` with string children renders them through `ClippedText` (in the list and as the
    trigger's chosen value); `SelectTrigger` no longer places `line-clamp-1` on its value.
  - It needs theme-core 0.12.19 for `.inline-name` and `.machine-text`
    (`docs/packages/ui-core.md` § Clipped text, § A name in a sentence, § Machine text, § Copying a
    value).
  - **Return scroll.** `useReturnScroll`'s `key` and the `key` of `saveReturnScroll`,
    `readReturnScroll` and `clearReturnScroll` are the app's whole session-storage key: the
    package's `'return-scroll:'` prefix is gone. The position is read and written through
    storage-core's guarded functions, so with site data blocked a saved position is held for the
    page's life and a return within it still restores (it was dropped before).
    `@ttt-productions/storage-core` is a new optional peer (`docs/packages/ui-core.md` § Return
    scroll).
- **What the app must change:**
  - **The return-scroll key.** ttt-prod hands in its whole key: a builder in ttt-core's
    `constants/storage-keys.ts` (in ttt-prod's own session) that turns the canonical hall-library
    browse URL into the key — `return-scroll:${href}` keeps the spelling tabs already hold. The
    three call sites pass it: `useReturnScroll({ key: … })` and `clearReturnScroll(…)` in
    `src/components/hall-library/hall-library-content.tsx`, and `clearReturnScroll(…)` in
    `src/app/hall-library/[hallItemId]/page.tsx`. storage-core 0.0.2 or later joins ttt-prod's
    dependencies, and its RULE-STD-FRONTEND-010 addition lists the return-scroll position among its
    device-local state.
  - The install, with theme-core 0.12.19 or later.
  - **Hand-placed clip classes onto `ClippedText`.** Every place ttt-prod's code names
    `single-line-truncate`, `two-line-clamp`, `three-line-clamp`, `name-piece`, or a Tailwind
    `truncate` / `line-clamp-*` / `text-ellipsis` renders its text through `ClippedText`: a plain
    tag through `as` (`<ClippedText as="p" className="…" text={title} />`), a component through
    `asChild`. No `ClippedText` is put inside a plain tag that holds nothing else, and no plain tag
    goes under `asChild`.
  - **Names written straight into sentences onto `InlineName`.** A user's or an item's name inside a
    sentence — a confirmation's title ("Delete <name>?"), a toast, a dialog line — renders through
    `InlineName`, with any mark beside it written in the sentence. A place that cannot take a second
    line (a button label, a table cell) is a box, and its whole text clips through `ClippedText`.
  - **Hand-placed `break-all` onto `MachineText`.** Each `break-all` (and any
    `word-break: break-all` / `overflow-wrap: anywhere` rule in its stylesheets) that keeps an id,
    an email, a hash, a file name or a URL on the page renders through `MachineText`, keeping its
    other classes (`<MachineText as="code" className="font-mono" text={value} />`). Where the break
    sits on a component — the `CardTitle` with `break-all` in
    `src/components/admin/work-views/guided-resolution-flow.tsx` — it uses `asChild`
    (`<MachineText asChild text={…}><CardTitle className="…" /></MachineText>`). Today these sit
    in the admin panels, the receipt toast, the reset-password action, the file preview dialog and
    `src/app/styles/info-pages.css`; a search for `break-all` lists them.
  - **The three hand-written copies onto `CopyButton`.** `src/components/shared/share-button.tsx`,
    `src/components/shared/receipt-toast.tsx` and `src/components/admin/operator-step-up-dialog.tsx`
    (the recovery codes and the enrolment key) stop calling `navigator.clipboard` and keeping their
    own copied state and timer: each renders `CopyButton` (or `ClippedText`'s `copy`) with its own
    title and its toast wording as `copiedToast` / `failedToast`, both required. A copy that today
    shows no success toast (the receipt toast, the enrolment key) or swallows a failure (the receipt
    toast) gets that wording added. Nothing in `src` calls the clipboard but the control.
  - A `SelectItem` that wraps its own label in `ClippedText` passes the string instead; the item
    clips it.
- **Done when:** the lockfile names `@ttt-productions/ui-core` 0.11.45 or later, the repo-guards
  truncation guard (repo-guards 0.1.58) is green with no exception, `src` holds no
  `navigator.clipboard` call, and every return-scroll call hands in the key from ttt-core.
