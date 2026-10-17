// The generic guards over client actions: callables, the auth boundary, browser storage, and media
// rendering. The registry runs every guard listed here; an app supplies each one's facts under its id.

import type { Absent, GenericGuardDefinition } from '../../config.js';
import {
  authFailureCaptureGuard,
  bannedAuthCallGuard,
  clientAuthBoundaryGuard,
  editorPermissionGateGuard,
  signOutLivenessGuard,
  type AuthFailureCaptureFacts,
  type BannedAuthCallFacts,
  type ClientAuthBoundaryFacts,
  type EditorPermissionGateFacts,
  type SignOutLivenessFacts,
} from './auth.js';
import {
  callableErrorCopyGuard,
  callableNameGuard,
  callableReadGuard,
  callableTransportGuard,
  doubleSurfaceGuard,
  errorInternalsGuard,
  type CallableErrorCopyFacts,
  type CallableNameFacts,
  type CallableReadFacts,
  type CallableTransportFacts,
  type DoubleSurfaceFacts,
  type ErrorInternalsFacts,
} from './callables.js';
import {
  appConfigReaderGuard,
  browserStorageGuard,
  dateOfBirthGuard,
  effectiveMotionGuard,
  mediaRendererGuard,
  mimePrefixGuard,
  partialMockGuard,
  uploadListenerGuard,
  type AppConfigReaderFacts,
  type BrowserStorageFacts,
  type DateOfBirthFacts,
  type EffectiveMotionFacts,
  type MediaRendererFacts,
  type MimePrefixFacts,
  type PartialMockFacts,
  type UploadListenerFacts,
} from './client.js';

/** The facts each guard in this area needs, by its id. */
export interface FrontendActionsGuardFacts {
  callableErrorCopy: CallableErrorCopyFacts;
  callableNames: CallableNameFacts;
  callableReads: CallableReadFacts;
  callableTransport: CallableTransportFacts;
  callableDoubleSurface: DoubleSurfaceFacts;
  errorInternalsRender: ErrorInternalsFacts;
  partialMocks: PartialMockFacts;
  clientAuthBoundary: ClientAuthBoundaryFacts | Absent;
  bannedAuthCalls: BannedAuthCallFacts | Absent;
  authFailureCapture: AuthFailureCaptureFacts | Absent;
  signOutLiveness: SignOutLivenessFacts | Absent;
  editorPermissionGate: EditorPermissionGateFacts;
  appConfigReader: AppConfigReaderFacts | Absent;
  browserStorage: BrowserStorageFacts;
  uploadListeners: UploadListenerFacts | Absent;
  mediaRenderer: MediaRendererFacts;
  mimePrefixClassification: MimePrefixFacts;
  effectiveMotion: EffectiveMotionFacts;
  dateOfBirthDerivation: DateOfBirthFacts | Absent;
}

export const FRONTEND_ACTIONS_GUARDS: ReadonlyArray<GenericGuardDefinition<never>> = Object.freeze([
  callableErrorCopyGuard,
  callableNameGuard,
  callableReadGuard,
  callableTransportGuard,
  doubleSurfaceGuard,
  errorInternalsGuard,
  partialMockGuard,
  clientAuthBoundaryGuard,
  bannedAuthCallGuard,
  authFailureCaptureGuard,
  signOutLivenessGuard,
  editorPermissionGateGuard,
  appConfigReaderGuard,
  browserStorageGuard,
  uploadListenerGuard,
  mediaRendererGuard,
  mimePrefixGuard,
  effectiveMotionGuard,
  dateOfBirthGuard,
] as ReadonlyArray<GenericGuardDefinition<never>>);
