// How a finished Archive all reads when some cards could not be archived: each failed on its own and
// stays in the list for a one-at-a-time archive.
export function archiveAllPartialOutcomeMessage(archived: number, notArchived: number): string {
  return `Archived ${archived}. ${notArchived} couldn't be archived and ${notArchived === 1 ? 'is' : 'are'} still in the list.`;
}
