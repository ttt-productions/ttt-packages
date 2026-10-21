// Every PUBLIC callable or webhook Cloud Run service must bind `allUsers` to `roles/run.invoker`.
// Without it the request is refused at the Cloud Run boundary and never reaches the function, so
// nothing runs, nothing throws, and nothing reaches error tracking. The auth and App Check gates
// live INSIDE each function; the platform binding has to be public for a request to arrive and be
// gated at all, so it is never a setting to tighten.

/** The label the Firebase CLI puts on every `onCall` function's service. */
export const CALLABLE_LABEL_FILTER = 'metadata.labels.deployment-callable=true';

export interface IamPolicy {
  bindings?: { role?: string; members?: string[] }[];
}

/** gcloud `value(...)` output as trimmed, `\r`-stripped, non-empty lines. */
export function lines(out: unknown): string[] {
  return String(out ?? '')
    .split(/\r?\n/)
    .map((line) => line.replace(/\r/g, '').trim())
    .filter(Boolean);
}

export function hasAllUsersInvoker(policy: IamPolicy | null | undefined): boolean {
  return (policy?.bindings ?? []).some(
    (binding) =>
      binding.role === 'roles/run.invoker' && (binding.members ?? []).includes('allUsers'),
  );
}

/**
 * The verdict over every service checked: which lack the binding, which could not be read, and
 * whether nothing was found at all — a check that read nothing proved nothing, so it fails.
 * `policies` maps a service to its parsed policy, or to an `Error` when it could not be read.
 */
export function assessInvokers(
  services: readonly string[],
  policies: ReadonlyMap<string, IamPolicy | Error>,
): { missing: string[]; unreadable: string[]; empty: boolean } {
  const missing: string[] = [];
  const unreadable: string[] = [];
  for (const name of services) {
    const policy = policies.get(name);
    if (policy === undefined || policy instanceof Error) {
      unreadable.push(
        policy instanceof Error ? `${name} (${policy.message})` : `${name} (no policy read)`,
      );
    } else if (!hasAllUsersInvoker(policy)) {
      missing.push(name);
    }
  }
  return { missing, unreadable, empty: services.length === 0 };
}
