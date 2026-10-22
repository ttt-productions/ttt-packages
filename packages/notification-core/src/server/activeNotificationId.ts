import { createHash } from 'node:crypto';

export function buildActiveNotificationDocId(params: {
  category: string;
  audienceType: 'personal' | 'shared';
  targetUserId: string | null | undefined;
  dedupKey: string;
  /** Omit for processBatchHelper's id, which must stay byte-identical: existing active docs live at it. */
  notificationType?: string;
}): string {
  const scope =
    params.audienceType === 'personal' ? `user:${params.targetUserId ?? 'null'}` : 'shared';
  const input =
    params.notificationType !== undefined
      ? `notif-active ${params.notificationType} ${scope} ${params.dedupKey}`
      : `${params.category} ${scope} ${params.dedupKey}`;
  return createHash('sha256').update(input).digest('hex').slice(0, 40);
}
