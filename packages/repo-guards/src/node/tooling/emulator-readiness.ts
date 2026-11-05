const SHOWN_MISSING = 5;

interface BackendsAnswer {
  backends?: readonly { functionTriggers?: readonly { name?: unknown }[] }[];
}

export function functionsEmulatorReady(facts: {
  port: number;
  host?: string;
  functions: readonly string[];
}): () => Promise<string | null> {
  const url = `http://${facts.host ?? '127.0.0.1'}:${facts.port}/backends`;
  return async () => {
    let answer: BackendsAnswer;
    try {
      const response = await fetch(url);
      if (!response.ok) return `GET /backends answered ${response.status}`;
      answer = (await response.json()) as BackendsAnswer;
    } catch {
      return 'GET /backends did not answer';
    }
    const loaded = new Set(
      (answer.backends ?? []).flatMap((backend) =>
        (backend.functionTriggers ?? []).flatMap((trigger) =>
          typeof trigger.name === 'string' ? [trigger.name] : [],
        ),
      ),
    );
    const missing = facts.functions.filter((name) => !loaded.has(name));
    if (missing.length === 0) return null;
    const shown = missing.slice(0, SHOWN_MISSING).join(', ');
    const more = missing.length > SHOWN_MISSING ? ', …' : '';
    return `${missing.length} of ${facts.functions.length} functions not loaded (${shown}${more})`;
  };
}
