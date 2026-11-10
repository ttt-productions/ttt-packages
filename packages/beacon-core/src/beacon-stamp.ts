import { z } from 'zod';

export interface BeaconStamp {
  updatedAt: number;
  changeId: string;
}

export function createBeaconStampSchema<Fields extends z.ZodRawShape>(fields: Fields) {
  return z
    .object({
      updatedAt: z.number().int().nonnegative(),
      changeId: z.string().min(1),
    })
    .extend(fields);
}
