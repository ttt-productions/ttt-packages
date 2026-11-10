import type { z } from 'zod';
import type { ServerCollectionRef, ServerDocRef } from '@ttt-productions/firebase-helpers/server';
import type { BeaconStamp } from '../beacon-stamp.js';

export interface BeaconStampWriter {
  set(ref: ServerDocRef, data: Record<string, unknown>): unknown;
}

export type BeaconStampSchema = z.ZodType<Record<string, unknown>, Record<string, unknown>>;

export interface BeaconStampRequest<Schema extends BeaconStampSchema> {
  beacon: ServerDocRef;
  ids: ServerCollectionRef;
  schema: Schema;
  fields: Omit<z.input<Schema>, keyof BeaconStamp>;
  now: number;
}

export function writeBeaconStamp<Schema extends BeaconStampSchema>(
  writer: BeaconStampWriter,
  request: BeaconStampRequest<Schema>,
): z.output<Schema> {
  const stamp = request.schema.parse({
    ...request.fields,
    updatedAt: request.now,
    // A document id minted locally: nothing is written to `ids`.
    changeId: request.ids.doc().id,
  });
  writer.set(request.beacon, stamp);
  return stamp;
}
