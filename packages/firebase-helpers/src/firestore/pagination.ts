import type {
    DocumentData,
    Query,
    QueryConstraint,
    QueryDocumentSnapshot,
    DocumentSnapshot
  } from "firebase/firestore";
  import {
    getDocs,
    limit,
    orderBy,
    query as fsQuery,
    startAfter
  } from "firebase/firestore";
  
  export type PageResult<T> = {
    items: QueryDocumentSnapshot<T>[];
    nextCursor: DocumentSnapshot<T> | null; // ✅ broadened
    size: number;
  };
  
  export async function fetchPage<T extends DocumentData>(
    baseQuery: Query<T>,
    opts: {
      pageSize: number;
      cursor?: DocumentSnapshot<T> | null; // ✅ broadened
      constraints?: QueryConstraint[];
    }
  ): Promise<PageResult<T>> {
    const constraints: QueryConstraint[] = [
      ...(opts.constraints ?? []),
      ...(opts.cursor ? [startAfter(opts.cursor)] : []),
      limit(opts.pageSize)
    ];
  
    const q = fsQuery(baseQuery, ...constraints);
    const snap = await getDocs(q);
  
    const docs = snap.docs;
    return {
      items: docs,
      nextCursor: docs.length ? docs[docs.length - 1] : null,
      size: docs.length
    };
  }
  
  export async function fetchOrderedPage<T extends DocumentData>(
    baseQuery: Query<T>,
    opts: {
      pageSize: number;
      orderByField: string;
      direction?: "asc" | "desc";
      cursor?: DocumentSnapshot<T> | null; // ✅ broadened
      constraints?: QueryConstraint[];
    }
  ): Promise<PageResult<T>> {
    return fetchPage(baseQuery, {
      pageSize: opts.pageSize,
      cursor: opts.cursor,
      constraints: [orderBy(opts.orderByField, opts.direction ?? "desc"), ...(opts.constraints ?? [])]
    });
  }
  