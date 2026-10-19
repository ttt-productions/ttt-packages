// The UI guards over shared interaction patterns: navigation only through the app's helper,
// pending feedback only through the shared primitives, one show-more control, one pending-name
// seat, and the root layout's provider order.

import type { GenericGuardDefinition } from '../../node/suite/config.js';
import type { Finding, Guard } from '../../guard.js';
import {
  ownerOnly,
  reviewedAllowlist,
  type AllowlistEntry,
  type Hit,
  type Matcher,
} from '../../shapes/shapes.js';
import {
  allowlistProblems,
  isText,
  namesProblem,
  objectProblem,
  pathProblem,
} from '../../support/facts.js';
import { MODULE_LOADS, moduleImports } from '../../support/imports.js';
import { escapeRegExp } from '../../support/text.js';
import { requirePathOrNull } from './facts.js';
import { exportedNames, jsxElements } from './source.js';
import { APP_CODE, APP_STYLES } from './styling.js';

const tsx = (text: string) => ({ path: 'sample.tsx', text });
const css = (text: string) => ({ path: 'sample.css', text });

/** Hits of each pattern in a file's comment-free code, each hit's text as its detail. */
const codeHits =
  (patterns: readonly RegExp[]): Matcher =>
  (file) => {
    const hits: Hit[] = [];
    for (const pattern of patterns) {
      for (const m of file.code.matchAll(new RegExp(pattern.source, 'g')))
        hits.push({ index: m.index ?? 0, detail: m[0].replace(/\s+/g, ' ') });
    }
    return hits.sort((a, b) => a.index - b.index);
  };

/** `import { … } from '<module>'` statements that name one of `names`; `modulePattern` matches the whole specifier. */
const namedImports =
  (modulePattern: string, names: readonly string[]): Matcher =>
  (file) => {
    if (file.kind !== 'code' && file.kind !== 'declarations') return [];
    const module = new RegExp(`^(?:${modulePattern})$`);
    const sf = file.sourceFile;
    const hits: Hit[] = [];
    for (const site of moduleImports(sf, ['import'])) {
      if (site.defaultName || site.namespace || !site.named.length || !module.test(site.spec))
        continue;
      if (!site.named.some((n) => names.includes(n.imported) || names.includes(n.local))) continue;
      const index = site.node.getStart(sf);
      hits.push({
        index,
        detail: file.code.slice(index, site.specifier.getEnd()).replace(/\s+/g, ' '),
      });
    }
    return hits;
  };

// ---- navigation only through the helper --------------------------------------------------------

export const rawLinkImports: Matcher = (file) =>
  file.kind === 'code'
    ? moduleImports(file.sourceFile, MODULE_LOADS)
        .filter((s) => s.spec === 'next/link')
        .map((s) => ({
          index: s.specifier.getStart(file.sourceFile),
          detail: `import of ${s.spec}`,
        }))
    : [];

export const routerUses: Matcher = (file) => [
  ...namedImports(String.raw`next\/(?:navigation|router)`, ['useRouter'])(file),
  ...codeHits([/\brouter\s*\.\s*(?:push|replace|back|forward)\s*\(/])(file),
];

export const locationNavigations = codeHits([
  /\b(?:window|document|globalThis|self)\s*\.\s*location(?:\s*\.\s*href)?\s*=(?!=)/,
  /(?<![.\w$])location\s*\.\s*href\s*=(?!=)/,
  /\blocation\s*\.\s*(?:assign|replace|reload)\s*\(/,
]);

export const guardedNavigationImports = namedImports(
  String.raw`@ttt-productions\/upload-ui[^'"]*`,
  ['GuardedLink', 'useGuardedNavigation'],
);

export interface NavigationFacts {
  /** The one navigation helper: the only caller of the framework link, router, and full-page loads. */
  helper: string;
  /** What the helper exports for the rest of the app to navigate with (its link component, its hook). */
  helperExports: readonly string[];
  /** The one module that calls the upload package's guarded navigation, or null when the app has no upload guard. */
  guardedNavigationOwner: string | null;
}

const NAVIGATION_FIX =
  "Navigate through the app's navigation helper — its link component for a link, its navigate() for a programmatic " +
  'or post-action navigation, its full-page load for a reload — so the navigation shows its own pending state and ' +
  'runs the upload guard. An outside link is a plain <a>.';

export const navigationGuard: GenericGuardDefinition<NavigationFacts> = {
  id: 'navigationHelper',
  absentWhen: false,
  factProblems(facts) {
    const problems: string[] = [];
    if (!objectProblem(facts, 'facts', problems)) return problems;
    pathProblem(facts.helper, 'helper', problems);
    namesProblem(facts.helperExports, 'helperExports', problems);
    requirePathOrNull(facts.guardedNavigationOwner, 'guardedNavigationOwner', problems);
    return problems;
  },
  build(facts): Guard[] {
    const owned = (title: string, match: Matcher, flags: string[], passes: string[]) =>
      ownerOnly({
        title,
        description: NAVIGATION_FIX,
        scope: APP_CODE,
        match,
        owners: [facts.helper],
        samples: { flags: flags.map(tsx), passes: passes.map(tsx) },
      });
    const guarded = {
      title: "the upload package's guarded navigation is called only by its one owner",
      description: `${NAVIGATION_FIX} The helper calls the upload package's GuardedLink / useGuardedNavigation; nothing else does.`,
      scope: APP_CODE,
      match: guardedNavigationImports,
      samples: {
        flags: [tsx("import { GuardedLink } from '@ttt-productions/upload-ui/react/guard';")],
        passes: [
          tsx("import { useLocalUploadGuard } from '@ttt-productions/upload-ui/react/guard';"),
        ],
      },
    };
    return [
      owned(
        'only the navigation helper imports the framework link',
        rawLinkImports,
        ["import Link from 'next/link';"],
        ["import { AppLink } from '@/nav';"],
      ),
      owned(
        'only the navigation helper imports or calls the router',
        routerUses,
        [
          "import { usePathname, useRouter } from 'next/navigation';",
          'router.push(`/x`); router.back();',
        ],
        [
          "import { usePathname, useSearchParams } from 'next/navigation';",
          'await navigate(`/x`);',
        ],
      ),
      owned(
        'only the navigation helper navigates through window.location',
        locationNavigations,
        [
          "window.location.href = '/x';",
          'window.location = url;',
          'window.location.replace(url); location.reload();',
        ],
        [
          'const here = window.location.pathname; if (window.location.href === target) {}',
          "window.history.replaceState({}, '', url);",
        ],
      ),
      facts.guardedNavigationOwner
        ? ownerOnly({ ...guarded, owners: [facts.guardedNavigationOwner] })
        : reviewedAllowlist({ ...guarded, allowlist: [] }),
      {
        title: 'the navigation helper exports what the app navigates with',
        description: `${NAVIGATION_FIX} The helper exists and exports each name the app config lists for it.`,
        run(context) {
          if (!context.reader.exists(facts.helper))
            return [{ file: facts.helper, detail: 'the navigation helper does not exist' }];
          const names = exportedNames(context.file(facts.helper));
          return facts.helperExports
            .filter((n) => !names.has(n))
            .map((n) => ({ file: facts.helper, detail: `no longer exports ${n}` }));
        },
      },
    ];
  },
};

// ---- pending feedback through the shared primitives ---------------------------------------------

/** lucide's spinner icon under every name it exports it as. */
const SPINNER_ICONS = [
  'Loader2',
  'Loader2Icon',
  'LucideLoader2',
  'LoaderCircle',
  'LoaderCircleIcon',
  'LucideLoaderCircle',
];
export const spinnerIconImports = namedImports('lucide-react', SPINNER_ICONS);
export const handSpunCode = codeHits([/\banimate-spin\b/]);
export const handSpunStyles: Matcher = (file) =>
  file.kind === 'stylesheet'
    ? codeHits([/\banimate-spin\b|animation(?:-name)?\s*:[^;]*\bspin\b|@keyframes\s+spin\b/])(file)
    : [];
export const pullToRefreshImports = namedImports(String.raw`@ttt-productions\/mobile-core[^'"]*`, [
  'PullToRefreshContainer',
]);

/** Where a hook's hook-wide flag is read: destructured from its call, read off the call, or off a binding of it. */
export function hookFlagReads(hook: string, flag: string): Matcher {
  const h = escapeRegExp(hook);
  const f = escapeRegExp(flag);
  return (file) => {
    const src = file.code;
    const hits: Hit[] = [];
    for (const m of src.matchAll(
      new RegExp(String.raw`const\s*\{([^}]*)\}\s*=\s*${h}\s*\(`, 'g'),
    )) {
      if (new RegExp(String.raw`\b${f}\b`).test(m[1]))
        hits.push({ index: m.index ?? 0, detail: m[0].replace(/\s+/g, ' ') });
    }
    for (const m of src.matchAll(new RegExp(String.raw`${h}\s*\([^)]*\)\s*\??\.\s*${f}\b`, 'g')))
      hits.push({ index: m.index ?? 0, detail: m[0] });
    for (const m of src.matchAll(
      new RegExp(String.raw`const\s+([A-Za-z_$][\w$]*)\s*=\s*${h}\s*\(`, 'g'),
    )) {
      const via = new RegExp(String.raw`\b${escapeRegExp(m[1])}\s*\??\.\s*${f}\b`, 'g');
      for (const r of src.matchAll(via)) hits.push({ index: r.index ?? 0, detail: r[0] });
    }
    return hits.sort((a, b) => a.index - b.index);
  };
}

export interface HookWideFlag {
  /** A hook whose return carries one flag for every action it runs. */
  hook: string;
  flag: string;
  /** The reviewed readers of that flag, each with its why. */
  readers: readonly AllowlistEntry[];
}

export interface LoadingFeedbackFacts {
  /** The app's one pull-to-refresh wrapper (it supplies the shared spinner), or null when the app has none. */
  pullToRefreshWrapper: string | null;
  hookWideFlags: readonly HookWideFlag[];
}

const PENDING_FIX =
  "Pending comes from the shared primitives (the control's own pending, the shared Spinner, the loading state, the " +
  'confirmation dialog) driven by the action itself.';

export const loadingFeedbackGuard: GenericGuardDefinition<LoadingFeedbackFacts> = {
  id: 'loadingFeedback',
  absentWhen: false,
  factProblems(facts) {
    const problems: string[] = [];
    if (!objectProblem(facts, 'facts', problems)) return problems;
    requirePathOrNull(facts.pullToRefreshWrapper, 'pullToRefreshWrapper', problems);
    if (!Array.isArray(facts.hookWideFlags))
      problems.push('hookWideFlags is missing (declare [] when there is none)');
    else {
      for (const entry of facts.hookWideFlags as HookWideFlag[]) {
        if (!isText(entry?.hook) || !isText(entry?.flag))
          problems.push('a hookWideFlags entry needs its hook and flag');
        else
          allowlistProblems(
            entry.readers,
            `hookWideFlags ${entry.hook}().${entry.flag} readers`,
            problems,
          );
      }
    }
    return problems;
  },
  build(facts): Guard[] {
    const pull = {
      title:
        "the mobile package's pull-to-refresh container is used only through the app's wrapper",
      description: `${PENDING_FIX} The app's one pull-to-refresh wrapper supplies the shared spinner as the refreshing indicator; everything else uses the wrapper.`,
      scope: APP_CODE,
      match: pullToRefreshImports,
      samples: {
        flags: [
          tsx("import { PullToRefreshContainer } from '@ttt-productions/mobile-core/react';"),
        ],
        passes: [tsx("import { useIsMobile } from '@ttt-productions/mobile-core/react';")],
      },
    };
    return [
      reviewedAllowlist({
        title: 'app code imports no hand-placed spinner icon',
        description: `${PENDING_FIX} lucide's spinner icon, under any name it exports it as (${SPINNER_ICONS.join(', ')}), is a second spinner recipe.`,
        scope: APP_CODE,
        match: spinnerIconImports,
        allowlist: [],
        samples: {
          flags: [
            tsx("import { Loader2, X } from 'lucide-react';"),
            tsx("import { LoaderCircle } from 'lucide-react';"),
            tsx("import { Loader2Icon } from 'lucide-react';"),
            tsx("import { LucideLoader2 as Spin } from 'lucide-react';"),
          ],
          passes: [
            tsx("import { RefreshCw } from 'lucide-react';"),
            tsx("import { Loader } from 'lucide-react';"),
          ],
        },
      }),
      reviewedAllowlist({
        title: 'app code hand-spins nothing',
        description: `${PENDING_FIX} An animate-spin class is a hand-spun indicator outside the shared spinner.`,
        scope: APP_CODE,
        match: handSpunCode,
        allowlist: [],
        samples: {
          flags: [tsx('<RefreshCw className="icon-xs animate-spin" />')],
          passes: [tsx('<Spinner size="xs" />')],
        },
      }),
      reviewedAllowlist({
        title: 'no app stylesheet hand-spins an element',
        description: `${PENDING_FIX} An app stylesheet never applies animate-spin, a spin animation, or its own spin keyframes.`,
        scope: APP_STYLES,
        match: handSpunStyles,
        allowlist: [],
        samples: {
          flags: [
            css('.a { animation: spin 1s linear infinite; }'),
            css('@keyframes spin { to { transform: rotate(360deg); } }'),
            css('.a { @apply animate-spin; }'),
          ],
          passes: [css('.a { animation: fade-in var(--motion-base) var(--motion-ease); }')],
        },
      }),
      facts.pullToRefreshWrapper
        ? ownerOnly({ ...pull, owners: [facts.pullToRefreshWrapper] })
        : reviewedAllowlist({ ...pull, allowlist: [] }),
      ...facts.hookWideFlags.map(({ hook, flag, readers }) =>
        reviewedAllowlist({
          title: `nothing reads ${hook}()'s hook-wide ${flag} but its reviewed readers`,
          description: `${PENDING_FIX} A hook-wide flag drives every control on the hook, so a control reads the pending of its own action (its own mutation hook) instead. A reviewed reader that stops reading the flag is stale: remove it, and the flag with it once no reader is left.`,
          scope: APP_CODE,
          match: hookFlagReads(hook, flag),
          allowlist: readers,
          samples: {
            flags: [
              tsx(`const { run, ${flag} } = ${hook}();`),
              tsx(`const busy = ${hook}({ x: 1 }).${flag};`),
              tsx(`const h = ${hook}(); return h.${flag};`),
            ],
            passes: [tsx(`const { run } = ${hook}(); const { ${flag} } = useQuery(q);`)],
          },
        }),
      ),
    ];
  },
};

// ---- one show-more control --------------------------------------------------------------------

const SHOW_HIDE_LABEL =
  /\b(?:show|hide|expand|collapse)\b|\b(?:read|see|view) (?:more|less|all)\b/i;
const CHEVRON_ICON = /<Chevrons?[A-Z]\w*/;

function openingTagEnd(code: string, start: number): number {
  let depth = 0;
  let quote: string | null = null;
  for (let i = start; i < code.length; i += 1) {
    const ch = code[i];
    if (quote) {
      if (ch === quote) quote = null;
    } else if (ch === '"' || ch === "'" || ch === '`') quote = ch;
    else if (ch === '{') depth += 1;
    else if (ch === '}') depth -= 1;
    else if (ch === '>' && depth === 0) return i + 1;
  }
  return code.length;
}

/** Every hand-rolled show/hide button (aria-expanded, labelled like a disclosure) and every native `<details>`. */
export const handRolledDisclosures: Matcher = (file) => {
  if (file.kind !== 'code') return [];
  const code = file.code;
  const hits: Hit[] = [];
  for (const m of code.matchAll(/<details[\s>]/g))
    hits.push({ index: m.index ?? 0, detail: '<details>' });
  for (const m of code.matchAll(/<(button|Button)(?=[\s>])/g)) {
    const start = m.index ?? 0;
    const end = openingTagEnd(code, start);
    const tag = code.slice(start, end);
    if (!/\baria-expanded\b/.test(tag) || tag.endsWith('/>')) continue;
    if (/role=["']combobox["']|\baria-haspopup\b/.test(tag)) continue;
    const close = code.indexOf(`</${m[1]}>`, end);
    const content = code.slice(end, close === -1 ? code.length : close);
    if (SHOW_HIDE_LABEL.test(content) || CHEVRON_ICON.test(content))
      hits.push({ index: start, detail: tag.replace(/\s+/g, ' ') });
  }
  return hits.sort((a, b) => a.index - b.index);
};

export interface ShowMoreFacts {
  /** The one show-more control every disclosure renders through. */
  toggle: string;
}

export const showMoreGuard: GenericGuardDefinition<ShowMoreFacts> = {
  id: 'showMoreToggle',
  absentWhen: false,
  factProblems(facts) {
    const problems: string[] = [];
    if (objectProblem(facts, 'facts', problems)) pathProblem(facts.toggle, 'toggle', problems);
    return problems;
  },
  build(facts) {
    return [
      reviewedAllowlist({
        title: `every show-more disclosure renders through ${facts.toggle}`,
        description:
          `A hand-rolled button carrying aria-expanded and labelled like a show/hide control (its words or a chevron), or a ` +
          `native <details>, builds the show-more control a second time. Render ${facts.toggle} instead. A combobox or a ` +
          'menu trigger (aria-haspopup) is not a disclosure.',
        scope: APP_CODE,
        match: handRolledDisclosures,
        allowlist: [],
        samples: {
          flags: [
            tsx(
              "<button type=\"button\" onClick={() => setExpanded((p) => !p)} aria-expanded={expanded}>\n  {expanded ? 'Show less' : 'Show more'}\n</button>",
            ),
            tsx('<Button aria-expanded={open} onClick={toggle}>Read more</Button>'),
            tsx(
              '<button aria-expanded={open}>Chapters<ChevronRight className="icon-xs" /></button>',
            ),
            tsx('<details>\n<summary>Notes</summary>\n</details>'),
          ],
          passes: [
            tsx(
              `<${facts.toggle} expanded={open} onExpandedChange={setOpen} openLabel="Show more" closeLabel="Show less" />`,
            ),
            tsx('<button role="combobox" aria-expanded={open}>Pick one<ChevronsUpDown /></button>'),
            tsx(
              '<Button aria-haspopup="menu" aria-expanded={open}>Show options<ChevronDown /></Button>',
            ),
            tsx('<Button aria-label="Files" aria-expanded={open}><Folder />Files</Button>'),
          ],
        },
      }),
    ];
  },
};

// ---- one pending-name seat ---------------------------------------------------------------------

export const busyNamePlaceholders = codeHits([
  /<span\b[^>]*\baria-busy\b|<span\b[^>]*>\s*(?:…|\.\.\.|\{\s*(['"`])(?:…|\.\.\.)\1\s*\})\s*<\/span>/,
]);

export interface PendingNameSeatFacts {
  /** The one module that renders a name still loading inside a line of text. */
  seat: string;
}

export const pendingNameSeatGuard: GenericGuardDefinition<PendingNameSeatFacts> = {
  id: 'pendingNameSeat',
  absentWhen: false,
  factProblems(facts) {
    const problems: string[] = [];
    if (objectProblem(facts, 'facts', problems)) pathProblem(facts.seat, 'seat', problems);
    return problems;
  },
  build(facts) {
    return [
      ownerOnly({
        title: 'a name still loading holds its place only through the one pending-name seat',
        description:
          'A name or title still loading inside a line of text holds its place with ONE seat, so every resolved-name ' +
          'surface shows a pending name the same way. A hand-written busy span, or a span holding only an ellipsis, is a ' +
          'second seat: render the shared seat instead.',
        scope: APP_CODE,
        match: busyNamePlaceholders,
        owners: [facts.seat],
        samples: {
          flags: [
            '<span aria-busy="true">…</span>',
            '<span className="x" aria-busy>…</span>',
            '<span>...</span>',
            '<span className="pending">{\'…\'}</span>',
          ].map(tsx),
          passes: [tsx('<span>Loading more…</span>'), tsx('<PendingNameSeat />')],
        },
      }),
    ];
  },
};

// ---- the root layout mounts its providers in order ---------------------------------------------

export interface LayoutOrderFacts {
  /** The root layout module. */
  layoutModule: string;
  /** Elements the layout mounts exactly once. */
  mountedOnce: readonly string[];
  /** Each outer element wraps its inner one. */
  wraps: ReadonlyArray<{ outer: string; inner: string }>;
  /** Each element sits outside its container. */
  outside: ReadonlyArray<{ element: string; container: string }>;
  /** Each first element opens before its then element. */
  precedes: ReadonlyArray<{ first: string; then: string }>;
}

function pairProblems(value: unknown, what: string, keys: readonly string[], problems: string[]) {
  if (!Array.isArray(value)) {
    problems.push(`${what} is missing (declare [] when there is none)`);
    return;
  }
  for (const entry of value as Array<Record<string, unknown>>)
    if (!keys.every((k) => isText(entry?.[k])))
      problems.push(`a ${what} entry needs ${keys.join(' and ')}`);
}

export const layoutOrderGuard: GenericGuardDefinition<LayoutOrderFacts> = {
  id: 'rootLayoutOrder',
  absentWhen: false,
  factProblems(facts) {
    const problems: string[] = [];
    if (!objectProblem(facts, 'facts', problems)) return problems;
    pathProblem(facts.layoutModule, 'layoutModule', problems);
    namesProblem(facts.mountedOnce, 'mountedOnce', problems, { nonEmpty: false });
    pairProblems(facts.wraps, 'wraps', ['outer', 'inner'], problems);
    pairProblems(facts.outside, 'outside', ['element', 'container'], problems);
    pairProblems(facts.precedes, 'precedes', ['first', 'then'], problems);
    const total = [facts.mountedOnce, facts.wraps, facts.outside, facts.precedes].reduce(
      (n, v) => n + (Array.isArray(v) ? v.length : 0),
      0,
    );
    if (!problems.length && !total) problems.push('declares no order to check');
    return problems;
  },
  build(facts): Guard[] {
    return [
      {
        title: 'the root layout mounts its guards and providers in their declared order',
        description:
          'Provider order in the root layout is load-bearing: a provider reads only what wraps it, and siblings mount ' +
          'in order. Each listed element is mounted once, each outer element wraps its inner one, each element sits ' +
          'outside its container, and each first element opens before its then element. Restore the order, or change it ' +
          "deliberately in the app's guard config.",
        run(context) {
          if (!context.reader.exists(facts.layoutModule))
            return [{ file: facts.layoutModule, detail: 'the root layout does not exist' }];
          const file = context.file(facts.layoutModule);
          const elements = jsxElements(file);
          const findings: Finding[] = [];
          const named = (name: string) => elements.filter((e) => e.name === name);
          const one = (name: string) => {
            const found = named(name);
            if (found.length !== 1)
              findings.push({
                file: file.path,
                detail: `<${name}> is mounted ${found.length} times; the order checks need exactly one`,
              });
            return found.length === 1 ? found[0] : null;
          };
          for (const name of facts.mountedOnce) {
            const n = named(name).length;
            if (n !== 1)
              findings.push({
                file: file.path,
                detail: `<${name}> is mounted ${n} times; it is mounted exactly once`,
              });
          }
          for (const { outer, inner } of facts.wraps) {
            const o = one(outer);
            const i = one(inner);
            if (o && i && !(o.start < i.start && i.end <= o.end))
              findings.push({
                file: file.path,
                line: file.lineOf(i.start),
                detail: `<${outer}> does not wrap <${inner}>`,
              });
          }
          for (const { element, container } of facts.outside) {
            const e = one(element);
            const c = one(container);
            if (e && c && c.start < e.start && e.end <= c.end)
              findings.push({
                file: file.path,
                line: file.lineOf(e.start),
                detail: `<${element}> sits inside <${container}>`,
              });
          }
          for (const { first, then } of facts.precedes) {
            const f = one(first);
            const t = one(then);
            if (f && t && !(f.start < t.start))
              findings.push({
                file: file.path,
                line: file.lineOf(f.start),
                detail: `<${first}> does not open before <${then}>`,
              });
          }
          return [...new Map(findings.map((f) => [`${f.line ?? ''}${f.detail}`, f])).values()];
        },
      },
    ];
  },
};
