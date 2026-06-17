// A controllable MOCK socket + a manual fake-timer clock for the realtime
// transport tests. No real network, no real timers — every test drives the socket
// open/message/close and advances time deterministically.

import type { RealtimeSocket, SocketFactory, SocketHandlers } from '../../src/realtime/socket.js';
import type { TransportTimers } from '../../src/realtime/shared.js';

export interface MockSocket extends RealtimeSocket {
  /** Frames the client sent, as parsed `{ v, type, payload }` objects. */
  readonly sent: Array<{ v: number; type: string; payload: Record<string, unknown> }>;
  /** The grant token offered when this socket was opened. */
  readonly grantToken: string;
  readonly url: string;
  /** Simulate the server accepting the upgrade. */
  serverOpen(): void;
  /** Simulate the DO sending a `{ v, type, payload }` frame. */
  serverFrame(type: string, payload: Record<string, unknown>): void;
  /** Simulate the socket closing (server or transport). */
  serverClose(code: number, reason?: string): void;
  /** True after close() / serverClose(). */
  readonly closed: boolean;
}

export interface MockSocketHarness {
  factory: SocketFactory;
  /** Every socket the factory has created, in order (reconnects append). */
  readonly sockets: MockSocket[];
  /** The most recently created socket. */
  last(): MockSocket;
}

export function createMockSocketHarness(): MockSocketHarness {
  const sockets: MockSocket[] = [];
  const factory: SocketFactory = ({ url, grantToken, handlers }) => {
    const s = makeMockSocket(url, grantToken, handlers);
    sockets.push(s);
    return s;
  };
  return {
    factory,
    sockets,
    last: () => sockets[sockets.length - 1],
  };
}

function makeMockSocket(url: string, grantToken: string, handlers: SocketHandlers): MockSocket {
  const sent: Array<{ v: number; type: string; payload: Record<string, unknown> }> = [];
  let open = false;
  let closed = false;
  return {
    url,
    grantToken,
    sent,
    get isOpen() {
      return open && !closed;
    },
    get closed() {
      return closed;
    },
    send(data: string) {
      if (!open || closed) return;
      sent.push(JSON.parse(data));
    },
    close(code = 1000, reason = '') {
      if (closed) return;
      closed = true;
      open = false;
      handlers.onClose(code, reason);
    },
    serverOpen() {
      open = true;
      handlers.onOpen();
    },
    serverFrame(type: string, payload: Record<string, unknown>) {
      handlers.onMessage(JSON.stringify({ v: 1, type, payload }));
    },
    serverClose(code: number, reason = '') {
      if (closed) return;
      closed = true;
      open = false;
      handlers.onClose(code, reason);
    },
  };
}

/** A manual clock: deterministic setTimeout/clearTimeout + now, advanced by `tick`. */
export interface FakeClock extends TransportTimers {
  /** Advance time by `ms`, firing any timers due in that window (in order). */
  tick(ms: number): void;
  /** Current virtual time. */
  current(): number;
}

export function createFakeClock(start = 0): FakeClock {
  let nowMs = start;
  let nextId = 1;
  const timers = new Map<number, { dueAt: number; fn: () => void }>();

  const clock: FakeClock = {
    now: () => nowMs,
    current: () => nowMs,
    setTimeout: (fn: () => void, ms: number) => {
      const id = nextId++;
      timers.set(id, { dueAt: nowMs + ms, fn });
      return id as unknown as ReturnType<typeof setTimeout>;
    },
    clearTimeout: (h: ReturnType<typeof setTimeout>) => {
      timers.delete(h as unknown as number);
    },
    tick(ms: number) {
      const target = nowMs + ms;
      // Fire timers in due order until we reach the target time.
      for (;;) {
        let nextDue: number | null = null;
        let nextKey: number | null = null;
        for (const [id, t] of timers) {
          if (t.dueAt <= target && (nextDue == null || t.dueAt < nextDue)) {
            nextDue = t.dueAt;
            nextKey = id;
          }
        }
        if (nextKey == null || nextDue == null) break;
        nowMs = nextDue;
        const t = timers.get(nextKey)!;
        timers.delete(nextKey);
        t.fn();
      }
      nowMs = target;
    },
  };
  return clock;
}
