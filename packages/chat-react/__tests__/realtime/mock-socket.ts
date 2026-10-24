import type { RealtimeSocket, SocketFactory, SocketHandlers } from '../../src/realtime/socket.js';
import type { TransportTimers } from '../../src/realtime/shared.js';

export interface MockSocket extends RealtimeSocket {
  readonly sent: Array<{ v: number; type: string; payload: Record<string, unknown> }>;
  readonly grantToken: string;
  readonly url: string;
  serverOpen(): void;
  serverFrame(type: string, payload: Record<string, unknown>): void;
  serverRaw(data: string): void;
  serverClose(code: number, reason?: string): void;
  readonly closed: boolean;
}

export interface MockSocketHarness {
  factory: SocketFactory;
  readonly sockets: MockSocket[];
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
      // The client sends every frame as the JSON of this envelope.
      sent.push(JSON.parse(data) as (typeof sent)[number]);
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
    serverRaw(data: string) {
      handlers.onMessage(data);
    },
    serverClose(code: number, reason = '') {
      if (closed) return;
      closed = true;
      open = false;
      handlers.onClose(code, reason);
    },
  };
}

export interface FakeClock extends TransportTimers {
  tick(ms: number): void;
  current(): number;
}

export function createFakeClock(start = 0): FakeClock {
  let nowMs = start;
  const timers = new Map<ReturnType<typeof setTimeout>, { dueAt: number; fn: () => void }>();

  const clock: FakeClock = {
    now: () => nowMs,
    current: () => nowMs,
    setTimeout: (fn: () => void, ms: number) => {
      const handle = setTimeout(() => {}, 0);
      clearTimeout(handle);
      timers.set(handle, { dueAt: nowMs + ms, fn });
      return handle;
    },
    clearTimeout: (h: ReturnType<typeof setTimeout>) => {
      timers.delete(h);
    },
    tick(ms: number) {
      const target = nowMs + ms;
      for (;;) {
        let nextDue: number | null = null;
        let nextKey: ReturnType<typeof setTimeout> | null = null;
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
