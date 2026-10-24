import { vi } from 'vitest';
import type { User } from 'firebase/auth';

// The real SDK, though the shared test setup mocks 'firebase/app' and 'firebase/auth': the
// instance is only a handle the code under test reads `currentUser` from, and creating one opens no connection.
const { initializeApp } = await vi.importActual<typeof import('firebase/app')>('firebase/app');
const { initializeAuth } = await vi.importActual<typeof import('firebase/auth')>('firebase/auth');

let created = 0;

export function testAuth(currentUser: () => User | null): ReturnType<typeof initializeAuth> {
  created += 1;
  const auth = initializeAuth(
    initializeApp({ apiKey: 'demo-key', projectId: 'demo-auth-core' }, `auth-core-test-${created}`),
  );
  Object.defineProperty(auth, 'currentUser', { get: currentUser });
  return auth;
}
