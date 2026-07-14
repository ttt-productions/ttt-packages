// The minimal socket abstraction the realtime clients drive, plus the default
// browser-WebSocket factory. Injectable so unit tests pass a MOCK socket and no
// real network is touched.
//
// Contract A transport: the grant token is offered as the SECOND WebSocket
// subprotocol — `Sec-WebSocket-Protocol: <CHAT_SUBPROTOCOL>, <grant-token>` —
// never in the URL (tokens never appear in URLs; Contract A). The browser sets
// that header from `new WebSocket(url, [CHAT_SUBPROTOCOL, grantToken])`. The
// worker validates cookie + grant + Origin BEFORE accept and echoes back only
// CHAT_SUBPROTOCOL.

import { CHAT_SUBPROTOCOL } from './wire.js';

/** Lifecycle events a socket surfaces to its owning client. */
export interface SocketHandlers {
  onOpen: () => void;
  onMessage: (data: string) => void;
  /** code/reason from the close frame (4401/4403/4408/4413/4429/1013 or transport codes). */
  onClose: (code: number, reason: string) => void;
  onError: () => void;
}

/** The transport-neutral socket the clients use. A mock implements the same shape in tests. */
export interface RealtimeSocket {
  /** Queue/send a text frame. No-op if not open. */
  send(data: string): void;
  /** Close the socket with an optional app code + reason. Idempotent. */
  close(code?: number, reason?: string): void;
  /** True once the underlying transport is OPEN (ready to send). */
  readonly isOpen: boolean;
}

/**
 * A factory that opens a socket to `url`, offering the chat subprotocol + the
 * grant token, and wires the handlers. Injected into the transport so tests
 * substitute a mock. The default factory uses the global `WebSocket`.
 */
export type SocketFactory = (args: {
  url: string;
  grantToken: string;
  handlers: SocketHandlers;
}) => RealtimeSocket;

/** A WebSocket-like minimal surface (so we don't hard-depend on lib.dom in node-safe builds). */
interface MinimalWebSocket {
  send(data: string): void;
  close(code?: number, reason?: string): void;
  readyState: number;
  onopen: ((ev: unknown) => void) | null;
  onmessage: ((ev: { data: unknown }) => void) | null;
  onclose: ((ev: { code: number; reason: string }) => void) | null;
  onerror: ((ev: unknown) => void) | null;
}

type WebSocketCtor = new (url: string, protocols?: string | string[]) => MinimalWebSocket;

const WS_OPEN = 1;

/**
 * The default browser socket factory. Offers `[CHAT_SUBPROTOCOL, grantToken]` as the
 * subprotocol list so the grant rides in `Sec-WebSocket-Protocol`, never the URL.
 */
export const browserSocketFactory: SocketFactory = ({ url, grantToken, handlers }) => {
  const Ctor = (globalThis as { WebSocket?: WebSocketCtor }).WebSocket;
  if (!Ctor) throw new Error('[chat-realtime] no global WebSocket available; inject a SocketFactory');
  const ws = new Ctor(url, [CHAT_SUBPROTOCOL, grantToken]);
  ws.onopen = () => handlers.onOpen();
  ws.onmessage = (ev) => handlers.onMessage(typeof ev.data === 'string' ? ev.data : String(ev.data));
  ws.onclose = (ev) => handlers.onClose(ev.code, ev.reason);
  ws.onerror = () => handlers.onError();
  return {
    send(data: string) {
      if (ws.readyState === WS_OPEN) ws.send(data);
    },
    close(code?: number, reason?: string) {
      try {
        ws.close(code, reason);
      } catch {
        /* already closing/closed */
      }
    },
    get isOpen() {
      return ws.readyState === WS_OPEN;
    },
  };
};
