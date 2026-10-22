import { CHAT_SUBPROTOCOL } from '@ttt-productions/chat-schemas';

export interface SocketHandlers {
  onOpen: () => void;
  onMessage: (data: string) => void;
  onClose: (code: number, reason: string) => void;
  onError: () => void;
}

export interface RealtimeSocket {
  send(data: string): void;
  close(code?: number, reason?: string): void;
  readonly isOpen: boolean;
}

export type SocketFactory = (args: {
  url: string;
  grantToken: string;
  handlers: SocketHandlers;
}) => RealtimeSocket;

// Structural, so node-safe builds need no lib.dom.
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

export const browserSocketFactory: SocketFactory = ({ url, grantToken, handlers }) => {
  const Ctor = (globalThis as { WebSocket?: WebSocketCtor }).WebSocket;
  if (!Ctor)
    throw new Error('[chat-realtime] no global WebSocket available; inject a SocketFactory');
  const ws = new Ctor(url, [CHAT_SUBPROTOCOL, grantToken]);
  ws.onopen = () => handlers.onOpen();
  ws.onmessage = (ev) =>
    handlers.onMessage(typeof ev.data === 'string' ? ev.data : String(ev.data));
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
