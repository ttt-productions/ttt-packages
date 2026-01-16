import type {
    DocumentData,
    Query,
    QueryConstraint,
    QueryDocumentSnapshot
  } from "firebase/firestore";
  import {
    getDocs,
    limit,
    orderBy,
    query as fsQuery,
    startAfter
  } from "firebase/firestore";
  
  /**
   * Cursor-based pagination helper.
   * - Keeps no global state.
   * - Caller decides ordering fields.
   */
  
  export type PageResult<T> = {
    items: QueryDocumentSnapshot<T>[];
    nextCursor: QueryDocumentSnapshot<T> | null;
    size: number;
  };
  
  export async function fetchPage<T extends DocumentData>(
    baseQuery: Query<T>,
    opts: {
      pageSize: number;
      cursor?: QueryDocumentSnapshot<T> | null;
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
  
  /**
   * Convenience: build a query with orderBy + optional extra constraints, then paginate.
   * Useful when you want to standardize orderBy in one place.
   */
  export async function fetchOrderedPage<T extends DocumentData>(
    baseQuery: Query<T>,
    opts: {
      pageSize: number;
      orderByField: string;
      direction?: "asc" | "desc";
      cursor?: QueryDocumentSnapshot<T> | null;
      constraints?: QueryConstraint[];
    }
  ): Promise<PageResult<T>> {
    return fetchPage(baseQuery, {
      pageSize: opts.pageSize,
      cursor: opts.cursor,
      constraints: [orderBy(opts.orderByField, opts.direction ?? "desc"), ...(opts.constraints ?? [])]
    });
  }
  