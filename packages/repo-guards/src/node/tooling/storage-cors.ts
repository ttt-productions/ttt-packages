export interface CorsEntry {
  origin?: string[];
  method?: string[];
  responseHeader?: string[];
  maxAgeSeconds?: number | string;
}

export function defaultStorageBucket(projectId: string): string {
  return `${projectId}.firebasestorage.app`;
}

export function normalizeCors(entries: readonly CorsEntry[]): unknown[] {
  return [...entries]
    .map((entry) => ({
      origin: [...(entry.origin ?? [])].sort(),
      method: [...(entry.method ?? [])].sort(),
      responseHeader: [...(entry.responseHeader ?? [])].sort(),
      maxAgeSeconds: Number(entry.maxAgeSeconds),
    }))
    .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
}

export function assertSafeCors(entries: unknown): asserts entries is CorsEntry[] {
  if (!Array.isArray(entries) || entries.length === 0) {
    throw new Error('cors.json must contain at least one rule');
  }
  if ((entries as CorsEntry[]).some((entry) => entry.origin?.some((o) => o.includes('*')))) {
    throw new Error('wildcard Storage CORS origins are forbidden');
  }
}

// gcloud names the field `cors_config` (not the JSON API's `cors`) and omits it when no policy is set.
export function readBucketCors(described: unknown): CorsEntry[] {
  if (described === null || typeof described !== 'object' || Array.isArray(described)) {
    throw new Error(`unexpected gcloud bucket description: ${JSON.stringify(described)}`);
  }
  const cors = (described as { cors_config?: unknown }).cors_config ?? [];
  if (!Array.isArray(cors)) {
    throw new Error(`unexpected cors_config shape: ${JSON.stringify(cors)}`);
  }
  return cors as CorsEntry[];
}
