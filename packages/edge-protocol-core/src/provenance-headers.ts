import { assertDistinctNames, assertHeaderName, assertHeaderValue } from './header-name.js';

export interface HeaderMarker {
  name: string;
  value: string;
}

export interface ProvenanceHeaderConfig {
  originMarker: HeaderMarker;
  edgeMarker: HeaderMarker;
  edgeSecret: string;
  canonicalHost: string;
  clientIp: string;
  verifiedClientIp: string;
}

export interface ProvenanceHeaders {
  readonly originMarker: Readonly<HeaderMarker>;
  readonly edgeMarker: Readonly<HeaderMarker>;
  readonly edgeSecret: string;
  readonly canonicalHost: string;
  readonly clientIp: string;
  readonly verifiedClientIp: string;
  readonly internalHeaders: readonly string[];
}

export function defineProvenanceHeaders(config: ProvenanceHeaderConfig): ProvenanceHeaders {
  assertHeaderName('originMarker.name', config.originMarker?.name);
  assertHeaderValue('originMarker.value', config.originMarker?.value);
  assertHeaderName('edgeMarker.name', config.edgeMarker?.name);
  assertHeaderValue('edgeMarker.value', config.edgeMarker?.value);
  assertHeaderName('edgeSecret', config.edgeSecret);
  assertHeaderName('canonicalHost', config.canonicalHost);
  assertHeaderName('clientIp', config.clientIp);
  assertHeaderName('verifiedClientIp', config.verifiedClientIp);
  assertDistinctNames([
    config.originMarker.name,
    config.edgeMarker.name,
    config.edgeSecret,
    config.canonicalHost,
    config.clientIp,
    config.verifiedClientIp,
  ]);

  return Object.freeze({
    originMarker: Object.freeze({
      name: config.originMarker.name,
      value: config.originMarker.value,
    }),
    edgeMarker: Object.freeze({ name: config.edgeMarker.name, value: config.edgeMarker.value }),
    edgeSecret: config.edgeSecret,
    canonicalHost: config.canonicalHost,
    clientIp: config.clientIp,
    verifiedClientIp: config.verifiedClientIp,
    internalHeaders: Object.freeze([
      config.edgeSecret,
      config.canonicalHost,
      config.clientIp,
      config.verifiedClientIp,
      config.originMarker.name,
    ]),
  });
}
