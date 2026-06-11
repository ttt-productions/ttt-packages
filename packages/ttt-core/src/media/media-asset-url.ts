// Render-time media URL building — pure and configuration-injected. ttt-core
// never reads process.env / window / Next config / Firebase state; the
// consuming app resolves its environment and constructs ONE builder
// (frontend: NEXT_PUBLIC_MEDIA_HOST + emulator flag; backend: function config).
// Gateway URLs are NEVER persisted — content docs store `*AssetId` refs and
// every render builds the URL from assetId + variant.
// See ttt-prod docs/design/media-assets-and-protected-serving.md.

/** Object key shared by R2 and the Storage emulator: mediaAssets/{assetId}/{variantKey}. */
export function buildMediaAssetKey(mediaAssetId: string, variantKey: string): string {
  return `mediaAssets/${mediaAssetId}/${variantKey}`;
}

/**
 * Fixed emulator-only download token. In emulator mode processors attach this
 * constant token to Storage-emulator objects (token URLs bypass rules in the
 * emulator; production never mints tokens for final media), so the builder can
 * produce deterministic emulator URLs with no Cloudflare involvement.
 */
export const EMULATOR_MEDIA_TOKEN = 'ttt-emulator-media-token';

export interface MediaUrlEmulatorConfig {
  /** Storage emulator origin, e.g. http://127.0.0.1:9199 */
  storageEmulatorOrigin: string;
  /** Emulator storage bucket name, e.g. ttt-dev-cfb70.appspot.com */
  bucket: string;
  /** Token attached by emulator-mode processors. Defaults to EMULATOR_MEDIA_TOKEN. */
  token?: string;
}

export interface MediaUrlBuilderConfig {
  /** Gateway host for deployed envs, e.g. media.ttt.productions */
  mediaHost?: string;
  /** When set, the builder is in emulator mode and ignores mediaHost. */
  emulator?: MediaUrlEmulatorConfig;
}

export interface BuildMediaAssetUrlOptions {
  /** Signed scoped-grant token (user-bound); appended for scoped-tier assets. */
  grant?: string;
  /** Request Content-Disposition: attachment from the gateway. */
  download?: boolean;
}

export type MediaAssetUrlBuilder = (
  mediaAssetId: string,
  variantKey: string,
  opts?: BuildMediaAssetUrlOptions,
) => string;

export function createMediaAssetUrlBuilder(config: MediaUrlBuilderConfig): MediaAssetUrlBuilder {
  if (config.emulator) {
    const { storageEmulatorOrigin, bucket, token = EMULATOR_MEDIA_TOKEN } = config.emulator;
    const origin = storageEmulatorOrigin.replace(/\/$/, '');
    return (mediaAssetId, variantKey) => {
      const objectPath = encodeURIComponent(buildMediaAssetKey(mediaAssetId, variantKey));
      return `${origin}/v0/b/${bucket}/o/${objectPath}?alt=media&token=${token}`;
    };
  }

  const mediaHost = config.mediaHost;
  if (!mediaHost) {
    throw new Error('createMediaAssetUrlBuilder: mediaHost is required outside emulator mode');
  }
  return (mediaAssetId, variantKey, opts) => {
    const params = new URLSearchParams();
    if (opts?.grant) params.set('grant', opts.grant);
    if (opts?.download) params.set('download', '1');
    const qs = params.size > 0 ? `?${params.toString()}` : '';
    return `https://${mediaHost}/assets/${encodeURIComponent(mediaAssetId)}/${encodeURIComponent(variantKey)}${qs}`;
  };
}
