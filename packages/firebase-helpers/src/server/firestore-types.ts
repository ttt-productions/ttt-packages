export interface ServerFirestore {
  collection(path: string): ServerCollectionRef;
  doc(path: string): ServerDocRef;
  batch(): ServerWriteBatch;
  runTransaction<T>(updateFunction: (transaction: ServerTransaction) => Promise<T>): Promise<T>;
  getAll(
    ...refsOrReadOptions: Array<ServerDocRef | { readonly fieldMask?: readonly unknown[] }>
  ): Promise<ServerDocSnapshot[]>;
}

export interface ServerTransaction {
  get(ref: ServerDocRef): Promise<ServerDocSnapshot>;
  get(query: ServerQuery): Promise<ServerQuerySnapshot>;
  set(
    ref: ServerDocRef,
    data: Record<string, unknown>,
    options?: { merge?: boolean },
  ): ServerTransaction;
  update(ref: ServerDocRef, data: Record<string, unknown>): ServerTransaction;
  delete(ref: ServerDocRef): ServerTransaction;
}

export interface ServerCollectionRef {
  doc(id?: string): ServerDocRef;
  where(field: string, op: string, value: unknown): ServerQuery;
  orderBy(field: string, direction?: 'asc' | 'desc'): ServerQuery;
  limit(n: number): ServerQuery;
  add(data: Record<string, unknown>): Promise<ServerDocRef>;
}

export interface ServerQuery {
  where(field: string, op: string, value: unknown): ServerQuery;
  orderBy(field: string, direction?: 'asc' | 'desc'): ServerQuery;
  limit(n: number): ServerQuery;
  startAfter(snapshot: ServerDocSnapshot): ServerQuery;
  startAfter(...fieldValues: unknown[]): ServerQuery;
  get(): Promise<ServerQuerySnapshot>;
}

export interface ServerQuerySnapshot {
  empty: boolean;
  size: number;
  docs: ServerDocSnapshot[];
}

export interface ServerDocSnapshot {
  id: string;
  exists: boolean;
  data(): Record<string, unknown> | undefined;
  ref: ServerDocRef;
  readonly updateTime?: ServerUpdateTime;
}

export interface ServerUpdateTime {
  toMillis(): number;
  isEqual(other: ServerUpdateTime): boolean;
}

export interface ServerDocRef {
  id: string;
  set(data: Record<string, unknown>, options?: { merge?: boolean }): Promise<unknown>;
  update(data: Record<string, unknown>): Promise<unknown>;
  create(data: Record<string, unknown>): Promise<unknown>;
  delete(precondition?: { lastUpdateTime?: ServerUpdateTime }): Promise<unknown>;
  get(): Promise<ServerDocSnapshot>;
}

export interface ServerWriteBatch {
  set(
    ref: ServerDocRef,
    data: Record<string, unknown>,
    options?: { merge?: boolean },
  ): ServerWriteBatch;
  update(ref: ServerDocRef, data: Record<string, unknown>): ServerWriteBatch;
  delete(ref: ServerDocRef): ServerWriteBatch;
  commit(): Promise<unknown>;
}
