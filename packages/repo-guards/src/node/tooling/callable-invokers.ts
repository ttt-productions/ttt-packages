export const CALLABLE_LABEL_FILTER = 'metadata.labels.deployment-callable=true';

export interface IamPolicy {
  bindings?: { role?: string; members?: string[] }[];
}

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
