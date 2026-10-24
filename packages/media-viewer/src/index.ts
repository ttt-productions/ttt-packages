export type {
  MediaViewerType,
  FallbackMode,
  MediaPlaybackControls,
  MediaProgressSampleReason,
} from './types.js';

export {
  BACKOFF_SCHEDULE_MS,
  MAX_RECOVERY_DURATION_MS,
  LOAD_WATCHDOG_MS,
  PHASE_MAX_WAIT_MS,
  applyJitter,
  backoffForAttempt,
  withinBudget,
} from './recovery.js';
export type {
  MediaDiagnosticAdapter,
  AssetStatusHint,
  DiagnosisResult,
  RecoveryState,
} from './recovery.js';

export { startWaveformLoop, drawIdleFrame } from './visualizer.js';
export type {
  StartWaveformLoopOptions,
  AudioVisualizerMode,
  VisualizerAnalyser,
  VisualizerCanvas,
  VisualizerContext,
} from './visualizer.js';

export { resolveInfiniteDuration } from './media-duration.js';
