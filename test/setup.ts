import '@testing-library/jest-dom';
import type { FirebaseApp } from 'firebase/app';
import type { WriteBatch } from 'firebase/firestore';
import { vi } from 'vitest';

type AppModule = typeof import('firebase/app');
type FirestoreModule = typeof import('firebase/firestore');
type AuthModule = typeof import('firebase/auth');
type StorageModule = typeof import('firebase/storage');
type FunctionsModule = typeof import('firebase/functions');

// jsdom lacks AnimationEvent, so React DOM, detecting at load, wires `webkitAnimationEnd` and
// `onAnimationEnd` never fires; this must run before any test file loads react-dom.
if (typeof window !== 'undefined' && !('AnimationEvent' in window)) {
  class AnimationEvent extends Event {
    readonly animationName: string;
    readonly elapsedTime: number;
    readonly pseudoElement: string;

    constructor(type: string, init: AnimationEventInit = {}) {
      super(type, init);
      this.animationName = init.animationName ?? '';
      this.elapsedTime = init.elapsedTime ?? 0;
      this.pseudoElement = init.pseudoElement ?? '';
    }
  }
  Object.defineProperty(window, 'AnimationEvent', {
    value: AnimationEvent,
    writable: true,
    configurable: true,
  });
}

// jsdom logs a "not implemented" error for every canvas getContext call.
if (typeof HTMLCanvasElement !== 'undefined') {
  HTMLCanvasElement.prototype.getContext = vi.fn(() => null);
}

vi.mock('firebase/app', async () => {
  const { stubModule } = await import('./typed-mock.js');
  const app: FirebaseApp = {
    name: '[DEFAULT]',
    options: {},
    automaticDataCollectionEnabled: false,
  };
  return stubModule<AppModule>({
    initializeApp: vi.fn(() => app),
    getApps: vi.fn(() => []),
    getApp: vi.fn(() => app),
  });
});

vi.mock('firebase/firestore', async () => {
  const { stubModule } = await import('./typed-mock.js');
  const actual = await vi.importActual<FirestoreModule>('firebase/firestore');
  const batch: WriteBatch = {
    set: vi.fn(() => batch),
    update: vi.fn(() => batch),
    delete: vi.fn(() => batch),
    commit: vi.fn(async () => undefined),
  };
  return stubModule<FirestoreModule>({
    getFirestore: vi.fn(),
    doc: vi.fn(),
    collection: vi.fn(),
    getDoc: vi.fn(),
    setDoc: vi.fn(),
    updateDoc: vi.fn(),
    deleteDoc: vi.fn(),
    addDoc: vi.fn(),
    query: vi.fn(),
    where: vi.fn(),
    orderBy: vi.fn(),
    limit: vi.fn(),
    getDocs: vi.fn(),
    onSnapshot: vi.fn(() => vi.fn()),
    runTransaction: vi.fn(),
    writeBatch: vi.fn(() => batch),
    serverTimestamp: actual.serverTimestamp,
    Timestamp: actual.Timestamp,
    connectFirestoreEmulator: vi.fn(),
    arrayUnion: actual.arrayUnion,
    arrayRemove: actual.arrayRemove,
    increment: actual.increment,
    documentId: actual.documentId,
    startAfter: vi.fn(),
    endBefore: vi.fn(),
  });
});

vi.mock('firebase/auth', async () => {
  const { stubModule } = await import('./typed-mock.js');
  const actual = await vi.importActual<AuthModule>('firebase/auth');
  return stubModule<AuthModule>({
    getAuth: vi.fn(),
    connectAuthEmulator: vi.fn(),
    onAuthStateChanged: vi.fn(() => vi.fn()),
    signInWithEmailAndPassword: vi.fn(),
    createUserWithEmailAndPassword: vi.fn(),
    signOut: vi.fn(async () => undefined),
    GoogleAuthProvider: actual.GoogleAuthProvider,
    signInWithPopup: vi.fn(),
  });
});

vi.mock('firebase/storage', async () => {
  const { stubModule } = await import('./typed-mock.js');
  return stubModule<StorageModule>({
    getStorage: vi.fn(),
    connectStorageEmulator: vi.fn(),
    ref: vi.fn(),
    uploadBytes: vi.fn(),
    uploadBytesResumable: vi.fn(),
    getDownloadURL: vi.fn(async () => 'https://mock-storage.example.com/file.jpg'),
    deleteObject: vi.fn(async () => undefined),
  });
});

vi.mock('firebase/functions', async () => {
  const { stubModule } = await import('./typed-mock.js');
  return stubModule<FunctionsModule>({
    getFunctions: vi.fn(),
    connectFunctionsEmulator: vi.fn(),
    httpsCallable: vi.fn(),
  });
});
