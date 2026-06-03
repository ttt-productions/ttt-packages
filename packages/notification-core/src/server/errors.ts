/**
 * Typed errors thrown by notification-core server helpers.
 */

/**
 * Thrown when a caller is not allowed to perform a notification action — e.g.
 * archiving a personal notification they do not own, or a non-admin archiving a
 * shared notification. Consuming callables should catch this and map it to a
 * `permission-denied` error code rather than surfacing a generic `internal`.
 */
export class NotificationPermissionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotificationPermissionError';
    // Restore the prototype chain so `instanceof` works across the transpile
    // target (extending built-ins can break it otherwise).
    Object.setPrototypeOf(this, NotificationPermissionError.prototype);
  }
}
