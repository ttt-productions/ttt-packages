// A game's `score`: each team's score, mirrored from its `stats.teamStats` line so a schedule or list
// reads the result without the stats. Every writer of a team line writes the mirror from the line it
// wrote, in the same write, through this one derivation (RULE-QS-SPORT-917).

/** Every sport's team line carries its `score`; the mirror is keyed by the same team ids. */
export function gameScoreMirror(stats: {
  readonly teamStats: Readonly<Record<string, { readonly score: number }>>;
}): Record<string, number> {
  return Object.fromEntries(
    Object.entries(stats.teamStats).map(([teamId, line]) => [teamId, line.score]),
  );
}
