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

export type SportLineSchemas<L extends LeagueType> = (typeof SPORT_LINE_SCHEMAS)[L];

export type SportLine<L extends LeagueType, K extends StatLineKind> = z.infer<
  SportLineSchemas<L>[K]
>;

export type SportGameStats<L extends LeagueType> = z.infer<(typeof SPORT_GAME_STATS_SCHEMAS)[L]>;

export const COLUMN_CATALOG_LINE_KINDS = {
  playerTotals: 'membershipRow',
  gamePlayer: 'gamePlayer',
  teamSeason: 'teamSeason',
} as const satisfies Record<ColumnCatalogKey, StatLineKind>;

export type ColumnCatalogRow<L extends LeagueType, K extends ColumnCatalogKey> = SportLine<
  L,
  (typeof COLUMN_CATALOG_LINE_KINDS)[K]
>;

export type SportColumnCatalogs<L extends LeagueType> = {
  readonly [K in ColumnCatalogKey]: ColumnCatalog<ColumnCatalogRow<L, K>>;
};

export interface SportDisplay<L extends LeagueType> {
  readonly label: string;
  readonly iconKey: SportIconKey;
  readonly lifetimeSummary: LifetimeSummary<SportLine<L, 'lifetime'>>;
  readonly eventLabels: Readonly<Record<SportTypeMap[L]['eventType'], StatEventLabel>>;
  readonly fieldLabels: StatFieldLabels<
    SportTypeMap[L]['teamStatKey'],
    SportTypeMap[L]['playerStatKey']
  >;
  readonly describeEvent: (event: GameStatEvent, resolve: StatEventNameResolver) => string;
  readonly rounds?: RoundsDisplay;
  readonly scoreboard: Scoreboard;
  readonly scoringPanel: ScoringPanel;
}

export interface GameTeamIds {
  readonly teamIds: readonly string[];
}

export interface SportAdapter<L extends LeagueType> extends SportScoring {
  readonly leagueType: L;
  readonly sportKey: (typeof SPORT_KEY_BY_LEAGUE_TYPE)[L];
  readonly eventTypes: readonly SportTypeMap[L]['eventType'][];
  readonly teamStatKeys: readonly SportTypeMap[L]['teamStatKey'][];
  readonly playerStatKeys: readonly SportTypeMap[L]['playerStatKey'][];
  readonly hallOfFame: boolean;
  readonly historicalBaseline: boolean;
  readonly lineSchemas: SportLineSchemas<L>;
  readonly display: SportDisplay<L>;
  readonly columns: SportColumnCatalogs<L>;
  readonly emptyStats: (game: GameTeamIds) => SportGameStats<L>;
  readonly bulkEntry: BulkEntry;
}

export type SportAdapterRegistry = { readonly [L in LeagueType]: SportAdapter<L> };

export type AnySportAdapter = SportAdapterRegistry[LeagueType];
