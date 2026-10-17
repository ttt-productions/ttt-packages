// The generic guards over server code: Cloud Functions and other backend trees. The registry runs every guard listed here; an app supplies
// each one's facts under its id.

import type { Absent, GenericGuardDefinition } from '../../config.js';
import {
  auditPayloadGuard,
  auditWriterGuard,
  failureAuditGuard,
  fireAndForgetGuard,
  type AuditPayloadFacts,
  type AuditWriterFacts,
  type FailureAuditFacts,
  type FireAndForgetFacts,
} from './audit.js';
import {
  adminClaimGuard,
  appCheckGuard,
  noBlockingFunctionGuard,
  requestOriginGuard,
  type AdminClaimFacts,
  type AppCheckFacts,
  type NoBlockingFunctionFacts,
  type RequestOriginFacts,
} from './auth.js';
import {
  postCommitCaptureGuard,
  scheduledPassGuard,
  swallowedReadWriteGuard,
  type PostCommitCaptureFacts,
  type ScheduledPassFacts,
  type SwallowedReadWriteFacts,
} from './failure-handling.js';
import {
  codebaseManifestGuard,
  lazyLoaderGuard,
  lightFunctionGuard,
  rateLimitGuard,
  type CodebaseManifestFacts,
  type LazyLoaderFacts,
  type LightFunctionFacts,
  type RateLimitFacts,
} from './functions-build.js';
import {
  monitoringGuard,
  telemetryTagGuard,
  unusedServiceGuard,
  type MonitoringFacts,
  type TelemetryTagFacts,
  type UnusedServiceFacts,
} from './monitoring.js';

export type { ReviewedFile, ServerZone } from './shared.js';

/** The facts each guard in this area needs, by its id. */
export interface BackendGuardFacts {
  auditWriter: AuditWriterFacts | Absent;
  auditPayload: AuditPayloadFacts | Absent;
  failureAuditChain: FailureAuditFacts | Absent;
  fireAndForget: FireAndForgetFacts;
  swallowedReadWrite: SwallowedReadWriteFacts;
  postCommitCapture: PostCommitCaptureFacts | Absent;
  scheduledPassIsolation: ScheduledPassFacts | Absent;
  monitoring: MonitoringFacts;
  telemetryTagKeys: TelemetryTagFacts | Absent;
  unusedService: UnusedServiceFacts | Absent;
  adminClaimRead: AdminClaimFacts | Absent;
  requestOrigin: RequestOriginFacts;
  noAuthBlockingFunction: NoBlockingFunctionFacts;
  appCheck: AppCheckFacts | Absent;
  rateLimitSurfaces: RateLimitFacts | Absent;
  lazyLoader: LazyLoaderFacts;
  lightFunctions: LightFunctionFacts | Absent;
  codebaseManifest: CodebaseManifestFacts | Absent;
}

export const BACKEND_GUARDS: ReadonlyArray<GenericGuardDefinition<never>> = Object.freeze([
  auditWriterGuard,
  auditPayloadGuard,
  failureAuditGuard,
  fireAndForgetGuard,
  swallowedReadWriteGuard,
  postCommitCaptureGuard,
  scheduledPassGuard,
  monitoringGuard,
  telemetryTagGuard,
  unusedServiceGuard,
  adminClaimGuard,
  requestOriginGuard,
  noBlockingFunctionGuard,
  appCheckGuard,
  rateLimitGuard,
  lazyLoaderGuard,
  lightFunctionGuard,
  codebaseManifestGuard,
] as ReadonlyArray<GenericGuardDefinition<never>>);
