import { vi } from 'vitest';

// The real SDK, though the shared test setup mocks 'firebase/app' and 'firebase/firestore': the
// instance is only a handle the mocked calls receive, and creating one opens no connection.
const { initializeApp } = await vi.importActual<typeof import('firebase/app')>('firebase/app');
const { getFirestore } =
  await vi.importActual<typeof import('firebase/firestore')>('firebase/firestore');

let created = 0;

export function testFirestore(): ReturnType<typeof getFirestore> {
  created += 1;
  return getFirestore(
    initializeApp({ projectId: 'demo-query-core' }, `query-core-test-${created}`),
  );
}
