import type { Absent, GenericGuardDefinition } from '../../node/suite/config.js';
import {
  auditPayloadGuard,
  auditWriterGuard,
  failureAuditGuard,
  fireAndForgetGuard,
  refusalAuditGuard,
  type AuditPayloadFacts,
  type AuditWriterFacts,
  type FailureAuditFacts,
  type FireAndForgetFacts,
  type RefusalAuditFacts,
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

export interface BackendGuardFacts {
  auditWriter: AuditWriterFacts | Absent;
  auditPayload: AuditPayloadFacts | Absent;
  failureAuditChain: FailureAuditFacts | Absent;
  refusalAudit: RefusalAuditFacts | Absent;
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
  refusalAuditGuard,
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
