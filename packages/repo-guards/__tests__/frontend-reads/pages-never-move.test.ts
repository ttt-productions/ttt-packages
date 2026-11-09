import { describe, expect, it } from 'vitest';
import type { Finding } from '../../src/guard.js';
import { checkSamples } from '../../src/node/suite/run.js';
import {
  pagesNeverMoveGuard,
  type PagesNeverMoveFacts,
} from '../../src/modules/frontend-reads/pages-never-move.js';
import { runDefinition } from './run.js';

const lines = (...l: string[]) => l.join('\n');
const show = (findings: Finding[]) =>
  findings.map((f) => `${f.file}${f.line ? `:${f.line}` : ''} ${f.detail}`);

const facts = (
  exceptions: Partial<PagesNeverMoveFacts['exceptions']> = {},
): PagesNeverMoveFacts => ({
  surfaceTrees: ['src/components'],
  gateComponents: ['LoadingState', 'ReadState', 'ListFrame'],
  readStateComponents: ['ReadState'],
  pendingSignals: ['data', 'items'],
  exceptions: { nullArms: [], emptyNull: [], latches: [], unansweredShowing: [], ...exceptions },
});

async function run(files: Record<string, string>, f: PagesNeverMoveFacts = facts()) {
  const [nullArms, emptyNull, latches, unanswered] = await runDefinition(pagesNeverMoveGuard, f, {
    'src/components/anchor.tsx': 'export const Anchor = () => <p />;',
    ...files,
  });
  return {
    nullArms: show(nullArms!),
    emptyNull: show(emptyNull!),
    latches: show(latches!),
    unanswered: show(unanswered!),
  };
}

describe('a component that renders a loading or read-state arm never renders nothing in another', () => {
  it('flags a list that shows its frame while pending and returns null once it answers empty', async () => {
    const { nullArms } = await run({
      'src/components/invitations.tsx': lines(
        'export function MyInvitations({ read }: Props) {',
        '  if (read.items?.length === 0) return null;',
        '  return <ListFrame read={read}>{rows}</ListFrame>;',
        '}',
      ),
      'src/components/notice.tsx': lines(
        'export const Notice = ({ read }: Props) =>',
        '  read.data === undefined ? <LoadingState /> : null;',
      ),
    });
    expect(nullArms).toEqual([
      'src/components/invitations.tsx:2 not on the reviewed list: renders a loading or read-state arm, and nothing (null) in another arm',
      'src/components/notice.tsx:2 not on the reviewed list: renders a loading or read-state arm, and nothing (null) in another arm',
    ]);
  });

  it('passes a null arm with no gate, a gate with no null arm, a nested callback returning null, and code outside the trees', async () => {
    const { nullArms } = await run({
      'src/components/plain.tsx': lines(
        'export function Plain({ show }: Props) {',
        '  if (!show) return null;',
        '  return <p>Shown</p>;',
        '}',
      ),
      'src/components/gated.tsx': lines(
        'export function Gated({ read }: Props) {',
        '  if (read.data === undefined) return <LoadingState />;',
        '  return <Rows rows={read.data} />;',
        '}',
      ),
      'src/components/callback.tsx': lines(
        'export function Callback() {',
        '  return <ReadState read={read} empty={<Empty />}>{() => null}</ReadState>;',
        '}',
      ),
      'src/lib/outside.tsx': lines(
        'export function Outside({ read }: Props) {',
        '  if (!read) return null;',
        '  return <LoadingState />;',
        '}',
      ),
    });
    expect(nullArms).toEqual([]);
  });

  it('passes a reviewed file and reports a stale entry', async () => {
    const files = {
      'src/components/reviewed.tsx': lines(
        'export const Reviewed = ({ open }: Props) => (open ? <LoadingState /> : null);',
      ),
    };
    const reviewed = facts({
      nullArms: [
        { path: 'src/components/reviewed.tsx', why: 'a dialog body that closes' },
        { path: 'src/components/gone.tsx', why: 'gone' },
      ],
    });
    expect((await run(files, reviewed)).nullArms).toEqual([
      'src/components/gone.tsx stale entry: the file no longer holds the pattern (or is gone, or is outside the scope)',
    ]);
  });
});

describe('a read-state never draws nothing for an answered empty read', () => {
  it('flags empty={null} on a read-state component and passes a real empty state', async () => {
    const { emptyNull } = await run({
      'src/components/week.tsx': lines(
        'export function Week() {',
        '  return <ReadState read={games} empty={null}>{(rows) => <Rows rows={rows} />}</ReadState>;',
        '}',
      ),
      'src/components/list.tsx': lines(
        'export function List() {',
        '  return <ReadState read={games} empty={<EmptyState />}>{render}</ReadState>;',
        '}',
      ),
      'src/components/other.tsx': 'export const Other = () => <Picker empty={null} />;',
    });
    expect(emptyNull).toEqual([
      'src/components/week.tsx:2 not on the reviewed list: <ReadState empty={null}> draws nothing once its read answers empty',
    ]);
  });
});

describe('no render-phase useState latch holds a section across a read', () => {
  it('flags a false flag set true during render and never back', async () => {
    const { latches } = await run({
      'src/components/doors.tsx': lines(
        'export function Doors() {',
        '  const showsNow = listShows(read);',
        '  const [appeared, setAppeared] = useState(false);',
        '  if (showsNow && !appeared) setAppeared(true);',
        '  if (!showsNow && !appeared) return null;',
        '  return <section />;',
        '}',
      ),
    });
    expect(latches).toEqual([
      'src/components/doors.tsx:4 not on the reviewed list: setAppeared(true) during render latches a section shown across a read',
    ]);
  });

  it('passes a flag set in a handler, a render-phase adjustment that follows its source, and a flag that is set back', async () => {
    const { latches } = await run({
      'src/components/handler.tsx': lines(
        'export function Handler() {',
        '  const [open, setOpen] = useState(false);',
        '  return <button onClick={() => setOpen(true)}>Open</button>;',
        '}',
      ),
      'src/components/adjust.tsx': lines(
        'export function Adjust({ live }: Props) {',
        '  const [held, setHeld] = useState(false);',
        '  if (held !== live) setHeld(live);',
        '  return <p>{String(held)}</p>;',
        '}',
      ),
      'src/components/reset.tsx': lines(
        'export function Reset({ shows }: Props) {',
        '  const [seen, setSeen] = useState(false);',
        '  if (shows && !seen) setSeen(true);',
        '  useEffect(() => () => setSeen(false), []);',
        '  return <p>{String(seen)}</p>;',
        '}',
      ),
    });
    expect(latches).toEqual([]);
  });
});

describe('a predicate never counts a read that has not answered as showing', () => {
  it('flags an or-chain that returns true for an unanswered read', async () => {
    const { unanswered } = await run({
      'src/components/shows.ts': lines(
        'export function listShows(read: Read): boolean {',
        '  return read.error !== null || read.items === undefined || read.items.length > 0;',
        '}',
      ),
      'src/components/arrow.ts':
        'export const shows = (data: Row[] | undefined) => data == null || data.length > 0;',
    });
    expect(unanswered).toEqual([
      'src/components/arrow.ts:1 not on the reviewed list: data == null || … counts a read that has not answered as showing',
      'src/components/shows.ts:2 not on the reviewed list: read.items === undefined || … counts a read that has not answered as showing',
    ]);
  });

  it('passes an and-chain, an or-chain in a condition, and a field that is no pending signal', async () => {
    const { unanswered } = await run({
      'src/components/and.ts':
        'export const shows = (read: Read) => read.items !== undefined && read.items.length > 0;',
      'src/components/guarded.ts': lines(
        'export function rowsOf(read: Read) {',
        '  if (read.items === undefined || read.items.length === 0) return [];',
        '  return read.items;',
        '}',
      ),
      'src/components/other.ts':
        'export const later = (game: Game) => game.endedAt === undefined || game.open;',
    });
    expect(unanswered).toEqual([]);
  });
});

describe('the pagesNeverMove facts', () => {
  it('refuses facts that name no gate, read-state, or pending signal', () => {
    expect(
      pagesNeverMoveGuard.factProblems({
        ...facts(),
        gateComponents: [],
        readStateComponents: [],
        pendingSignals: [],
      }),
    ).toEqual(
      expect.arrayContaining([
        expect.stringContaining('gateComponents'),
        expect.stringContaining('readStateComponents'),
        expect.stringContaining('pendingSignals'),
      ]),
    );
  });

  it("holds every check's own samples", () => {
    for (const guard of pagesNeverMoveGuard.build(facts())) {
      expect(() => checkSamples(guard)).not.toThrow();
    }
  });
});
