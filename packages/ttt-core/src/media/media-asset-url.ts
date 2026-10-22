export function buildMediaAssetKeyPrefix(mediaAssetId: string): string {
  return `mediaAssets/${mediaAssetId}`;
}

export function buildMediaAssetKey(mediaAssetId: string, variantKey: string): string {
  return `${buildMediaAssetKeyPrefix(mediaAssetId)}/${variantKey}`;
}

export const EMULATOR_MEDIA_TOKEN = 'ttt-emulator-media-token';

export interface MediaUrlEmulatorConfig {
  storageEmulatorOrigin: string;
  bucket: string;
  token?: string;
}

export interface MediaUrlBuilderConfig {
  mediaHost?: string;
  emulator?: MediaUrlEmulatorConfig;
}

export interface BuildMediaAssetUrlOptions {
  grant?: string;
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
