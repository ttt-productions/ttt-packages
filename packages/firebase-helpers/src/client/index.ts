export {
  initFirebaseClient,
  getFirebaseClient,
  tryGetFirebaseClient,
  __resetFirebaseClientCache,
} from './firebase-init.js';
export type {
  AppCheckClientOptions,
  EmulatorPorts,
  FirebaseAnalyticsHandle,
  FirebaseClientHandles,
  InitFirebaseClientOptions,
} from './firebase-init.js';
export { awaitFirstToken } from './app-check-ready.js';
export type { AwaitFirstTokenOptions } from './app-check-ready.js';
export {
  classifyBootLookupFailure,
  getLastBootLookupFailureClass,
  installAuthBootLookupGuard,
  runGuardedBootLookup,
} from './auth-boot-lookup-guard.js';
export type {
  BootLookupFailureClass,
  BootLookupResponse,
  GuardedBootLookupOptions,
} from './auth-boot-lookup-guard.js';
export {
  callCallable,
  stripUndefinedDeep,
  FUNCTIONS_UNAVAILABLE_MESSAGE,
} from './call-callable.js';
export type {
  CallCallableCallbacks,
  CallCallableTransport,
  FunctionsProvider,
} from './call-callable.js';
export { isRecoveredFallbackReport } from './recovered-fallback.js';
export { peekPersistedAuthUser } from './persisted-auth-peek.js';
export type { PersistedAuthUserPeek } from './persisted-auth-peek.js';
