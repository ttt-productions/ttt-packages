export type SweepReportKind = 'positionSave';

export interface SweepReportContext {
  readonly kind: SweepReportKind;
}

export type SweepReport = (error: unknown, context: SweepReportContext) => void;

export async function saveAfterRowFailure(
  save: () => Promise<void>,
  report: SweepReport,
): Promise<void> {
  try {
    await save();
  } catch (saveError) {
    report(saveError, { kind: 'positionSave' });
  }
}
