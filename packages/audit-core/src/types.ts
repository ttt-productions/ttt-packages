/**
 * Generic audit-event record. Consumers parameterize the type-discriminator
 * (`TEventType`), actor shape, target shape, and metadata shape.
 */
export interface AuditEvent<
  TEventType extends string = string,
  TActor = string,
  TTarget = string,
  TMetadata = Record<string, unknown>,
> {
  id: string;
  type: TEventType;
  schemaVersion: number;

  actor: TActor | null;
  target: TTarget | null;

  timestamp: number;

  ip: string | null;
  userAgent: string | null;
  region: string | null;

  metadata: TMetadata;
  result: "success" | "failure";
  failureReason: string | null;

  correlationId: string | null;
}
