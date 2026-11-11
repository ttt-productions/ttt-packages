# Adopt @ttt-productions/repo-guards 0.1.58

**What:** The colour guard allows the site definition's theme and background colours, and nothing else, in the one module the app declares; the truncation guard reads `ClippedText`'s `as`, `InlineName` and `MachineText`; the Firestore-runtime-in-UI guard takes no reviewed list; the browser-storage guard flags every code reference to `localStorage` / `sessionStorage`.
**Severity:** low

- **Package and version:** `@ttt-productions/repo-guards` 0.1.58.
- **Release:** `./scripts/release-multiple.sh dev-standards storage-core firebase-helpers
  ui-core repo-guards theme-core consent-core query-core app-config-core notification-core
  sweep-core auth-core q-core media-viewer file-input upload-core patch`.
- **What changed:**
  - `generic.colorLiterals` ("every color in app code and stylesheets resolves through a theme
    token") takes a new optional fact, `siteDefinitionModule`: the repo-relative path of the module
    that holds the app's one site-core `SiteDefinition`. In that module, and only there, the
    `themeColor` and `backgroundColor` of that one object may each be a single string literal
    holding a concrete colour (a hex, `rgb()` or `hsl()`), because a web manifest and the
    `theme-color` tag are read outside CSS and cannot resolve a token. The object is a
    `const x: SiteDefinition = {…}` or an object `satisfies SiteDefinition`, the type imported by
    name from `@ttt-productions/site-core`. Every other colour in that module still fails, and so
    do those two fields in any other file. It is a fact, not an entry in `exceptions`.
  - The fact may be left out: with none declared the guard allows no colour anywhere, exactly as
    before. Once declared, the guard fails when the module is missing, is a test file, is outside
    the app root, or holds no object typed `SiteDefinition` or more than one.
  - `generic.sharedTruncation` ("text is clipped only through the clip component, never by a class
    placed by hand") also fails, under its trees:
    - a `ClippedText asChild` or `MachineText asChild` whose one child is a plain tag (`<h2 />`,
      `<p />`, `<code />`, …): a plain tag is named with `as`;
    - a plain tag whose only content is a `ClippedText` (`<h2><ClippedText … /></h2>`): the tag is
      named with `as` instead;
    - a break utility in code (`break-all`, `wrap-anywhere`, `[word-break:break-all]`,
      `[overflow-wrap:anywhere]`, with or without a variant prefix), an inline `wordBreak:
      'break-all'` or `overflowWrap: 'anywhere'`, and any of the new `breakClasses` named in code:
      machine text goes through ui-core's `MachineText`, a name in a sentence through `InlineName`;
    - a stylesheet rule setting `word-break: break-all` or `overflow-wrap: anywhere` (or
      `word-wrap: anywhere`, or applying a break utility) unless its every selector is a
      `breakOwners` selector.
    Two facts are new and required: `breakClasses` (the classes `InlineName` and `MachineText`
    place) and `breakOwners` (`{ selector, why }` entries, non-empty, each stale once no loaded
    stylesheet breaks with it). The guard's description names the new forms.
  - `generic.firestoreRuntimeInUi` ("no component or route imports the Firestore runtime") loses
    its `sanctioned` fact: the guard has no reviewed list, since no provider reads Firestore itself
    (RULE-STD-FRONTEND-104). Its facts are `uiFolders` alone. A config that still declares
    `sanctioned` fails the type check (an unknown property of the facts type).
  - `generic.browserStorage` ("browser storage is touched only through the guarded helper") reads
    the syntax tree: every code reference to `localStorage` or `sessionStorage` fails — a member or
    index access as before, and now also the storage area read whole (`window.localStorage`,
    `window['sessionStorage']`, a destructured `{ localStorage }`), the form a hand-written guard
    takes. A comment, a string, or an object property named like one is not code and passes. Its
    findings name the storage (`localStorage`), not the access. Its facts are unchanged.
- **What the app must change for `browserStorage`:** its `helper` fact names storage-core
  (`helper: "storage-core's readStoredValue / writeStoredValue"`), where the helper now lives
  (storage-core 0.0.2). ttt-prod's own code names either storage only in comments and strings, so
  the stricter match adds no finding.
- **What the app must change for `firestoreRuntimeInUi`:** delete the empty `sanctioned: []` line
  from `firestoreRuntimeInUi` in `src/__tests__/guards/config/firestore.ts`. Leave
  `firestoreClientWrites: { sanctioned: [] }` as it is: that guard keeps its list.
- **What the app must change:** for the colour guard, the install alone changes nothing. When ttt-prod writes its site definition for `@ttt-productions/site-core` 0.0.2 or later,
  its two colours fail the colour guard until it adds the fact to its `colorLiterals` facts:
  `colorLiterals: { exceptions: […], siteDefinitionModule: '<the module that holds the site definition>' }`.
  The colours are not added to `exceptions`.
- **What the app must change for the truncation guard:** add to `sharedTruncation`'s facts
  `breakClasses: ['inline-name', 'machine-text']` and `breakOwners: [{ selector: '.inline-name',
  why: … }, { selector: '.machine-text', why: … }]` (theme-core 0.12.19 declares both). The guard
  then fails at each place ttt-prod clips through a wrapping plain tag, puts a plain tag under
  `asChild`, or breaks machine text by hand (its `break-all` classes and the
  `word-break: break-all` rule in `src/app/styles/info-pages.css`), until each moves onto
  `ClippedText`'s `as`, `InlineName` or `MachineText` (ui-core 0.11.45). That red is expected; no
  entry goes on the reviewed list to quiet it.
- **Done when:** the lockfiles name `@ttt-productions/repo-guards` 0.1.58 or later, and, once
  ttt-prod has its site definition, its `colorLiterals` facts declare `siteDefinitionModule` and the
  colour guard is green with no exception for that module, and `sharedTruncation` declares
  `breakClasses` and `breakOwners` and is green with no exception, and `firestoreRuntimeInUi`
  declares only `uiFolders` and is green, and `browserStorage` names storage-core and is green with
  no reviewed entry.
