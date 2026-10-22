export class NotificationPermissionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotificationPermissionError';
    // Restores the prototype chain, which extending a built-in can break under the transpile target.
    Object.setPrototypeOf(this, NotificationPermissionError.prototype);
  }
}
