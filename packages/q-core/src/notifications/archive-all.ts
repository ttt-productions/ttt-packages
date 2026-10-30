export function archiveAllPartialOutcomeMessage(archived: number, notArchived: number): string {
  return `Archived ${archived}. ${notArchived} couldn't be archived and ${notArchived === 1 ? 'is' : 'are'} still in the list.`;
}
