// Edge→origin provenance headers — the wire names a Worker front door and the
// origin behind it must agree on, byte for byte. ONE definition, imported by
// every participating tree: the Worker that mints the provenance headers, the
// origin middleware that validates the secret+host pair and mints the verified
// client IP, and the origin guards that consume it.
//
// Names only, deliberately: each side's trust LOGIC differs (the Worker deletes
// every client-supplied copy before building its upstream request; the origin
// validates the pair, mints the verified IP, then strips the transport headers
// before application code runs). What must never drift is the strings — a
// one-sided rename fails no build in any tree, it fails silently at runtime as
// "provenance missing", which is the security gate quietly changing behavior.
//
// Runtime-neutral: plain string constants, no dependency on any runtime's
// Headers implementation.
//
// ARCH-201 NAMED EXCEPTION — the `x-ttt-*` names below are TTT-branded values in
// a generic package, which ARCH-201 otherwise prohibits. They are kept here as a
// reviewed exception because this package OWNS the edge↔origin wire contract:
// these are the literal bytes two independently deployed runtimes must agree on,
// not business policy, app config, or copy. Renaming one is a protocol break, and
// ARCH-005 requires exactly one definition for a cross-tree trust contract — a
// per-tree copy is the drift that rule exists to prevent. The same treatment
// covers `chat-schemas`' `CHAT_SUBPROTOCOL` / `CHAT_GRANT_AUDIENCE`; the full list
// lives in docs/packages/package-architecture.md § Direction rules.
//
// The exception is scoped to a single adopting product. If a second product ever
// adopts edge-protocol-core, these constants must be relocated (an app-supplied
// header-name configuration, or a per-product contract package) or the exception
// revisited — a second consumer is exactly the reuse ARCH-201 protects, and a
// branded name would then be wrong for one of them.

/** Response marker proving the origin produced the response. The front door
 * keys its retry classifier on this header's ABSENCE (a synthetic upstream-edge
 * error carries no marker because the origin never ran) and strips it from the
 * public response. */
export const ORIGIN_MARKER_HEADER = 'x-ttt-app-origin';
export const ORIGIN_MARKER_VALUE = 'next';

/** Public liveness marker the front door adds to every response it serves, so a
 * hosted test can prove the front door is actually carrying the traffic. */
export const EDGE_MARKER_HEADER = 'x-ttt-app-edge';
export const EDGE_MARKER_VALUE = 'v1';

/** Shared origin secret. The front door sends it; the origin compares it against
 * its own configured value — half of the trust pair. */
export const EDGE_SECRET_HEADER = 'x-ttt-edge-secret';
/** The exact public host the front door intended. The origin must match it
 * against the canonical host it would serve — the other half of the trust pair,
 * so a valid secret alone cannot re-target the request at another host. */
export const EDGE_CANONICAL_HOST_HEADER = 'x-ttt-canonical-host';
/** Client IP as the front door observed it, populated ONLY from the CDN's own
 * connecting-IP value — never from a client-supplied forwarding header. */
export const EDGE_CLIENT_IP_HEADER = 'x-ttt-client-ip';

/** Minted by the origin middleware and ONLY there, after the secret+host pair
 * validates. Request-only: never sent by the front door, always deleted inbound,
 * so its presence is itself the proof that the request came through the front
 * door. Sensitive routes trust this value and nothing else. */
export const VERIFIED_CLIENT_IP_HEADER = 'x-ttt-verified-client-ip';

/**
 * Every provenance header a client could try to forge. All of them are deleted
 * from an inbound request before the front door adds its own, so no origin can
 * observe a client-supplied copy of any of them. The public liveness marker is
 * deliberately absent: it is a response header, never read inbound.
 */
export const EDGE_INTERNAL_HEADERS = [
  EDGE_SECRET_HEADER,
  EDGE_CANONICAL_HOST_HEADER,
  EDGE_CLIENT_IP_HEADER,
  VERIFIED_CLIENT_IP_HEADER,
  ORIGIN_MARKER_HEADER,
] as const;

export type EdgeInternalHeader = (typeof EDGE_INTERNAL_HEADERS)[number];
