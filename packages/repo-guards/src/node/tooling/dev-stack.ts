// Stop an app's local stack on Windows. Pass 1 kills the process tree of anything listening on the
// app's local ports. Pass 2 catches stragglers that hold no port (a wedged emulator, an orphaned
// watcher) by command line.

import { execFileSync } from 'node:child_process';

export interface DevStackConfig {
  /** The app's name in messages. */
  name: string;
  /** Every local port the stack listens on. */
  ports: readonly number[];
  /** Command-line fragments of the stack's processes. */
  signatures: readonly string[];
  /**
   * A straggler must ALSO name one of these (the repository's folder, its dev project id), matched
   * without regard to case, so another product's stack is never touched.
   */
  repoMarkers: readonly string[];
}

const LISTENING = /^\s*TCP\s+\S+:(\d+)\s+\S+\s+LISTENING\s+(\d+)\s*$/;

/** Whether a process command line is one of the stack's processes. */
export function isStackProcess(config: DevStackConfig, commandLine: string): boolean {
  const lower = commandLine.toLowerCase();
  return (
    config.repoMarkers.some((marker) => lower.includes(marker.toLowerCase())) &&
    config.signatures.some((sig) => lower.includes(sig.toLowerCase()))
  );
}

/** The `port -> pid` rows of `netstat -ano -p TCP` output that are listening on `ports`. */
export function listeningOn(netstat: string, ports: ReadonlySet<number>): [number, string][] {
  const rows: [number, string][] = [];
  for (const line of netstat.split(/\r?\n/)) {
    const match = LISTENING.exec(line);
    if (match && ports.has(Number(match[1]))) rows.push([Number(match[1]), match[2]!]);
  }
  return rows;
}

function run(file: string, args: readonly string[]): { ok: boolean; output: string } {
  try {
    return {
      ok: true,
      output: execFileSync(file, args, {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
        windowsHide: true,
      }),
    };
  } catch {
    return { ok: false, output: '' };
  }
}

/**
 * Off Windows, and when the port or process listing cannot be read, it stops rather than reading
 * the stack as empty: a stack wrongly reported stopped keeps holding its ports.
 */
export function killDevStack(config: DevStackConfig): void {
  if (config.repoMarkers.length === 0) {
    console.error(
      "dev:kill: no repository markers given, so another product's stack could be killed.",
    );
    process.exit(1);
  }
  if (process.platform !== 'win32') {
    console.error(
      'dev:kill is Windows-only. Stop the local stack from its terminal on this platform.',
    );
    process.exit(1);
  }
  const probe = (file: string, args: readonly string[], what: string): string => {
    const result = run(file, args);
    if (!result.ok) {
      console.error(`dev:kill: could not ${what} (${file} failed). The stack state is unknown.`);
      process.exit(1);
    }
    return result.output;
  };
  const killTree = (pid: string, reason: string): void => {
    if (!/^\d+$/.test(pid) || pid === '0' || pid === String(process.pid)) return;
    const { output } = run('taskkill.exe', ['/PID', pid, '/T', '/F']);
    console.log(`${/success/i.test(output) ? 'killed' : 'kill attempted'}: PID ${pid} (${reason})`);
  };

  const ports = new Set(config.ports);
  const killed = new Set<string>();
  let found = 0;
  for (const [port, pid] of listeningOn(
    probe('netstat.exe', ['-ano', '-p', 'TCP'], 'enumerate listening ports'),
    ports,
  )) {
    if (killed.has(pid)) continue;
    killed.add(pid);
    found += 1;
    killTree(pid, `listening on :${port}`);
  }

  const rows = probe(
    'powershell.exe',
    [
      '-NoProfile',
      '-Command',
      'Get-CimInstance Win32_Process | Where-Object { $_.Name -match "node|java|cmd" } | ForEach-Object { "$($_.ProcessId)`t$($_.CommandLine)" }',
    ],
    'enumerate running processes',
  );
  for (const line of rows.split(/\r?\n/)) {
    const tab = line.indexOf('\t');
    if (tab < 0) continue;
    const pid = line.slice(0, tab).trim();
    const commandLine = line.slice(tab + 1).trim();
    if (!commandLine || killed.has(pid) || !isStackProcess(config, commandLine)) continue;
    killed.add(pid);
    found += 1;
    killTree(pid, commandLine.slice(0, 120));
  }

  if (found === 0) {
    console.log(`dev:kill: no ${config.name} local-stack process found; every local port is free.`);
    return;
  }
  const still = listeningOn(
    probe('netstat.exe', ['-ano', '-p', 'TCP'], 're-check the local ports after killing'),
    ports,
  ).map(([port, pid]) => `:${port} (PID ${pid})`);
  if (still.length > 0) {
    console.error(`dev:kill: ports still held: ${still.join(', ')}`);
    console.error('Re-run this command; if it persists, that PID is being respawned by something.');
    process.exit(1);
  }
  console.log(`dev:kill: stopped ${found} process tree(s); ${config.name} local ports are free.`);
}
