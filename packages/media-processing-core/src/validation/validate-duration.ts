export function validateDuration(
    durationSec: number,
    maxDurationSec: number
  ): boolean {
    return durationSec <= maxDurationSec;
  }
  