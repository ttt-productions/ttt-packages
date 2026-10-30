export function gameScoreMirror(stats: {
  readonly teamStats: Readonly<Record<string, { readonly score: number }>>;
}): Record<string, number> {
  return Object.fromEntries(
    Object.entries(stats.teamStats).map(([teamId, line]) => [teamId, line.score]),
  );
}
