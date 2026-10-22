import { assertDistinctNames, assertHeaderName } from './header-name.js';

export interface InternalAuthHeaderConfig {
  signature: string;
  timestamp: string;
  version: string;
  operationId?: string;
}

export type InternalAuthHeaders<T extends InternalAuthHeaderConfig = InternalAuthHeaderConfig> =
  Readonly<T>;

export type InternalPrecheckHeaderNames = Pick<InternalAuthHeaderConfig, 'timestamp' | 'version'>;

export function defineInternalAuthHeaders<const T extends InternalAuthHeaderConfig>(
  config: T,
): InternalAuthHeaders<T> {
  assertHeaderName('signature', config.signature);
  assertHeaderName('timestamp', config.timestamp);
  assertHeaderName('version', config.version);
  const names = [config.signature, config.timestamp, config.version];
  if (config.operationId !== undefined) {
    assertHeaderName('operationId', config.operationId);
    names.push(config.operationId);
  }
  assertDistinctNames(names);
  return Object.freeze({ ...config });
}
