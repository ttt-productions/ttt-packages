// The sport adapter contract: one adapter per sport owns everything about that sport, and every
// shared surface asks it rather than branching on a sport (SPORT-003, SPORT-004). Every member is
// pure — no Firestore operation, no clock, no minted id, no React — so both app roots run the one
// copy (ARCH-101, ARCH-202).

import type { z } from 'zod';
import type { SPORT_LINE_SCHEMAS } from '../doc-schemas/aggregate-stats.js';
import type { SPORT_GAME_STATS_SCHEMAS } from '../doc-schemas/sport-game.js';
import type {
  BasketballPlayerStatKey,
  BasketballStatEventType,
  BasketballTeamStatKey,
  CurlingStatEventType,
  CurlingTeamStatKey,
  FootballStatEventType,
  FootballTeamStatKey,
  LeagueType,
  SPORT_KEY_BY_LEAGUE_TYPE,
  SportIconKey,
} from '../types/sports.js';
import type { StatLineKind } from '../types/stats.js';
import type { GameStatEvent } from '../doc-schemas/game-stats.js';
import type { BulkEntry } from './bulk-entry.js';
import type { ColumnCatalog, ColumnCatalogKey } from './column-catalog.js';
import type { LifetimeSummary } from './lifetime-summary.js';
import type { SportScoring } from './scoring.js';
import type {
  RoundsDisplay,
  Scoreboard,
  ScoringPanel,
  StatEventLabel,
  StatEventNameResolver,
  StatFieldLabels,
} from './scoring-display.js';

// Each sport's declared vocabulary, keyed by `leagueType`. Its lines, and the game payload built
// from them, come from `SPORT_LINE_SCHEMAS`.
export interface SportTypeMap {
  readonly Basketball: {
    readonly eventType: BasketballStatEventType;
    readonly teamStatKey: BasketballTeamStatKey;
    readonly playerStatKey: BasketballPlayerStatKey;
  };
  readonly Curling: {
    readonly eventType: CurlingStatEventType;
    readonly teamStatKey: CurlingTeamStatKey;
    readonly playerStatKey: never;
  };
  readonly Football: {
    readonly eventType: FootballStatEventType;
    readonly teamStatKey: FootballTeamStatKey;
    readonly playerStatKey: never;
  };
}

/**
 * The schema of each of the sport's stat lines, by kind. A stored line is read as this sport's line
 * through its schema — chosen by the adapter `leagueType` selected, never inferred from the line's
 * shape (SPORT-002).
 */
export type SportLineSchemas<L extends LeagueType> = (typeof SPORT_LINE_SCHEMAS)[L];

/** `never` for a kind the sport keeps no line of. */
export type SportLine<L extends LeagueType, K extends StatLineKind> = z.infer<SportLineSchemas<L>[K]>;

/** The game `stats` payload of one sport: its team lines and roster-entry lines. */
export type SportGameStats<L extends LeagueType> = z.infer<(typeof SPORT_GAME_STATS_SCHEMAS)[L]>;

// The line kind each stats table reads its rows from. Standings rows are team season lines; the
// game page's rows are player game lines; every player-totals table — league rankings, the team
// page, the hall of fame — reads rows shaped as membership rows.
export const COLUMN_CATALOG_LINE_KINDS = {
  playerTotals: 'membershipRow',
  gamePlayer: 'gamePlayer',
  teamSeason: 'teamSeason',
} as const satisfies Record<ColumnCatalogKey, StatLineKind>;

export type ColumnCatalogRow<L extends LeagueType, K extends ColumnCatalogKey> = SportLine<
  L,
  (typeof COLUMN_CATALOG_LINE_KINDS)[K]
>;

/** A sport's three column catalogs, each over its own row type; a sport missing one does not compile. */
export type SportColumnCatalogs<L extends LeagueType> = {
  readonly [K in ColumnCatalogKey]: ColumnCatalog<ColumnCatalogRow<L, K>>;
};

/** What shared surfaces render for the sport instead of branching on it (SPORT-004, SPORT-209). */
export interface SportDisplay<L extends LeagueType> {
  readonly label: string;
  readonly iconKey: SportIconKey;
  /** The profile's lifetime summary for the sport: its totals, and its per-game averages beneath. */
  readonly lifetimeSummary: LifetimeSummary<SportLine<L, 'lifetime'>>;
  /** Each of the sport's event types: its scoring-panel button and its play-by-play label. */
  readonly eventLabels: Readonly<Record<SportTypeMap[L]['eventType'], StatEventLabel>>;
  /** Each counter of a team line and of a player line — what a correction row and the Correct a game form name. */
  readonly fieldLabels: StatFieldLabels<SportTypeMap[L]['teamStatKey'], SportTypeMap[L]['playerStatKey']>;
  /** One play-by-play line for any stored event but a void, a correction included. */
  readonly describeEvent: (event: GameStatEvent, resolve: StatEventNameResolver) => string;
  /** Present only for a sport played in rounds: the header's round line and the scoreboard's grid. */
  readonly rounds?: RoundsDisplay;
  readonly scoreboard: Scoreboard;
  /** The one component of the scoring screen that is the sport's own, named by its kind. */
  readonly scoringPanel: ScoringPanel;
}

/** The game an empty rollup is built for: its real (non-bye) teams. */
export interface GameTeamIds {
  readonly teamIds: readonly string[];
}

/**
 * One sport's adapter: its facts, its scoring members, its display, its column catalogs, and its
 * bulk entry. The scoring members are typed over every sport, so any registered adapter is called
 * the same way.
 */
export interface SportAdapter<L extends LeagueType> extends SportScoring {
  readonly leagueType: L;
  /** The storage key: `sportHallOfFame/{sportKey}`, `historicalStats/{sportKey}`, `lifetimeStats.{sportKey}`. */
  readonly sportKey: (typeof SPORT_KEY_BY_LEAGUE_TYPE)[L];
  /** The sport's own event types; the store-level void and correction belong to every sport. */
  readonly eventTypes: readonly SportTypeMap[L]['eventType'][];
  /** The counters of a team line and of a player line — what the aggregates sum and a ghost link merges. */
  readonly teamStatKeys: readonly SportTypeMap[L]['teamStatKey'][];
  readonly playerStatKeys: readonly SportTypeMap[L]['playerStatKey'][];
  /** Whether the sport keeps `sportHallOfFame/{sportKey}` and the hall-of-fame page serves it. */
  readonly hallOfFame: boolean;
  /** Whether an admin may enter pre-Q-Sports career totals for the sport. */
  readonly historicalBaseline: boolean;
  readonly lineSchemas: SportLineSchemas<L>;
  readonly display: SportDisplay<L>;
  readonly columns: SportColumnCatalogs<L>;
  /**
   * The rollup of a game with no events (SPORT-105): a team line for each of the game's teams, and
   * no player lines. Every call returns new objects.
   */
  readonly emptyStats: (game: GameTeamIds) => SportGameStats<L>;
  /** The sport's bulk-entry form, whose rules `validate` enforces again on every event it becomes. */
  readonly bulkEntry: BulkEntry;
}

/** Every registered adapter, by `leagueType`. Indexing it with a generic sport keeps the sport. */
export type SportAdapterRegistry = { readonly [L in LeagueType]: SportAdapter<L> };

export type AnySportAdapter = SportAdapterRegistry[LeagueType];
