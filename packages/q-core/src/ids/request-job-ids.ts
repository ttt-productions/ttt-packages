import { z } from 'zod';
import { COMPOUND_ID_SEPARATOR } from './compound-ids.js';

const requestIdSchema = z.uuid();
const REQUEST_ID_LENGTH = 36;

export interface RequestJobIdParts {
  userId: string;
  requestId: string;
}

export function buildRequestJobId(userId: string, requestId: string): string {
  return [userId, requestId].join(COMPOUND_ID_SEPARATOR);
}

export function parseRequestJobId(id: string): RequestJobIdParts | null {
  const separatorAt = id.length - REQUEST_ID_LENGTH - COMPOUND_ID_SEPARATOR.length;
  if (separatorAt < 1 || !id.startsWith(COMPOUND_ID_SEPARATOR, separatorAt)) return null;
  const userId = id.slice(0, separatorAt);
  const requestId = id.slice(separatorAt + COMPOUND_ID_SEPARATOR.length);
  if (userId.includes('/') || !requestIdSchema.safeParse(requestId).success) return null;
  return { userId, requestId };
}
