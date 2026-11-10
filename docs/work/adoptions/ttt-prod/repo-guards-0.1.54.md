# Adopt @ttt-productions/repo-guards 0.1.54

**What:** The guard reader walks only authored files, an unreadable path is a named finding, a failing git command carries git's own reason, and the live-subscription guard counts package exports that always subscribe.
**Severity:** medium
**Came from:** the Q-Sports repo-guards walk ttt-packages session

- **Package and version:** `@ttt-productions/repo-guards` 0.1.54.
- **Release:** `./scripts/release-multiple.sh beacon-core firebase-helpers monitoring-core notification-core query-core repo-guards q-core patch`.
- **What changed:**
  - Under every declared root but `coreDist`, the walk skips every path the repository's
    `.gitignore` files ignore — the root one and every nested one
    (`git ls-files --others --ignored --exclude-per-directory=.gitignore --directory`, run once per
    reader at the layout's repository root). A machine's global excludes file and the checkout's
    `.git/info/exclude` never count, so every checkout walks the same files. Tracked files and
    untracked files the `.gitignore` files do not ignore are walked as before; `coreDist` is still
    walked whole. Gitignored run output, caches, and local env files under a root are in no guard's
    file list any more, so a run that creates and deletes them while the guards run cannot fail a
    guard.
  - The repository root must be in a git work tree. When the git command fails, the walk fails
    with the command and git's own message.
  - A file or folder a guard's walk or read cannot open while the guard runs (it vanished or is
    locked) is a finding of that guard naming the path and its error code
    (`<path> — could not be read while the guard ran (<code>)`), not a bare error.
  - The `lineEndings` guard's `git ls-files --eol` failure names the guard title, the command, and
    git's stderr.
  - `repoGit` (the release tooling's git) runs through the same git runner: a failing git command
    names the command and git's stderr, and git's stderr is no longer echoed to the console.
  - The live-subscription guard (`firestoreLiveSubscriptions`) counts a use of a package export
    that always opens a live Firestore read (`LIVE_BY_CONSTRUCTION`) as live mode, beside a
    `subscribe` option or an `onSnapshot` call: a call, a JSX render, or any other value reference,
    imported by name or through a namespace, and a re-export of one (named, aliased, `export *`
    from its entry, or `export { X }` of the imported binding). A type-only import or re-export is
    not a use. The finding reads
    `<path>:<line> — not on the reviewed list: <export> (live by construction, from <entry>)`, with
    `, re-exported` after the entry for a re-export. The listed exports:
    - `@ttt-productions/beacon-core/react`: `useBeaconObserver`
    - `@ttt-productions/chat-react`: `ChatShell`, `useChatMessages`
    - `@ttt-productions/notification-core/react`: `NotificationList`, `useActiveNotifications`
    - `@ttt-productions/query-core/react`: `createAppConfig`, `useFirestoreLiveInfinite`
    - `@ttt-productions/report-core/react`: `useCheckedOutTasks`
    - `@ttt-productions/upload-ui/react/tray`: `InFlightUploadsProvider`
- **What the app must change:**
  - The install.
  - Its guard layout's `exclusions`: an entry whose path the repository's `.gitignore` files ignore
    is now redundant — the walk never reaches it — and it fails the layout whenever that path is
    deleted. Remove each such entry; keep only exclusions of authored paths.
  - A declared root or anchor (other than `coreDist`) that lies under a path the repository's
    `.gitignore` files ignore is no longer reached, and the suite's anchor check fails naming it.
    Point it at an authored path.
  - A guard of the app's own that relied on the walk handing it a file the `.gitignore` files
    ignore now never sees it; it reads that file by name instead.
  - The live-subscription allowlist: every app source file that uses or re-exports any listed
    export above needs a reviewed entry with why it needs real-time delivery. A file that
    re-exports one (an app barrel) is the reviewed one; the files importing it through that barrel
    are not followed, so the barrel's entry states why its importers need real-time delivery. A file already on the list for its own
    `subscribe` or `onSnapshot` keeps its one entry; an entry whose file now only uses a listed
    export is no longer stale.
- **Done when:** the lockfile names repo-guards 0.1.54, the layout carries no exclusion of a path
  the repository's `.gitignore` files ignore, every app file that uses a listed export is on the
  live-subscription list with its why, and the guard suite is green — including while a run that
  writes gitignored output under a root is live.
