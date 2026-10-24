export interface AwaitFirstTokenOptions {
  getToken: () => Promise<unknown>;
  delaysMs?: readonly number[];
  sleep?: (ms: number) => Promise<void>;
  onExhausted?: (lastError: unknown) => void;
}

const DEFAULT_DELAYS_MS = [1000, 3000, 5000] as const;

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export async function awaitFirstToken(options: AwaitFirstTokenOptions): Promise<boolean> {
  const delays = options.delaysMs ?? DEFAULT_DELAYS_MS;
  const sleep = options.sleep ?? defaultSleep;

  let lastError: unknown;
  for (let attempt = 0; attempt <= delays.length; attempt++) {
    if (attempt > 0) await sleep(delays[attempt - 1]);
    try {
      await options.getToken();
      return true;
    } catch (error) {
      lastError = error;
    }
  }
  options.onExhausted?.(lastError);
  return false;
}
