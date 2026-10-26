import '@testing-library/jest-dom';
import type { FirebaseApp } from 'firebase/app';
import { vi } from 'vitest';

type AppModule = typeof import('firebase/app');
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

vi.mock(import('firebase/app'), async (importOriginal) => {
  const { stubModule } = await import('@ttt-productions/dev-standards/testing');
  const app: FirebaseApp = {
    name: '[DEFAULT]',
    options: {},
    automaticDataCollectionEnabled: false,
  };
  return stubModule(importOriginal, {
    initializeApp: vi.fn(() => app),
    getApps: vi.fn<AppModule['getApps']>(() => []),
    getApp: vi.fn<AppModule['getApp']>(() => app),
  });
});

// Every reference, query, and value is the real SDK's; a read or write reaches no server, so it fails
// unless the suite installs the in-memory client Firestore.
vi.mock(import('firebase/firestore'), async (importOriginal) => {
  const { passThroughModule } = await import('@ttt-productions/dev-standards/testing');
  const unserved = (name: string) => (): never => {
    throw new Error(
      `firebase/firestore ${name} reached no server: install the in-memory client Firestore for this suite`,
    );
  };
  return passThroughModule(importOriginal, {
    getDoc: unserved('getDoc'),
    getDocFromCache: unserved('getDocFromCache'),
    getDocFromServer: unserved('getDocFromServer'),
    getDocs: unserved('getDocs'),
    getDocsFromCache: unserved('getDocsFromCache'),
    getDocsFromServer: unserved('getDocsFromServer'),
    getCountFromServer: unserved('getCountFromServer'),
    getAggregateFromServer: unserved('getAggregateFromServer'),
    onSnapshot: unserved('onSnapshot'),
    onSnapshotsInSync: unserved('onSnapshotsInSync'),
    setDoc: unserved('setDoc'),
    updateDoc: unserved('updateDoc'),
    deleteDoc: unserved('deleteDoc'),
    addDoc: unserved('addDoc'),
    runTransaction: unserved('runTransaction'),
    writeBatch: unserved('writeBatch'),
  });
});

vi.mock(import('firebase/auth'), async (importOriginal) => {
  const { stubModule } = await import('@ttt-productions/dev-standards/testing');
  const actual = await vi.importActual<AuthModule>('firebase/auth');
  return stubModule(importOriginal, {
    getAuth: vi.fn<AuthModule['getAuth']>(),
    connectAuthEmulator: vi.fn<AuthModule['connectAuthEmulator']>(),
    onAuthStateChanged: vi.fn<AuthModule['onAuthStateChanged']>(() => vi.fn()),
    signInWithEmailAndPassword: vi.fn<AuthModule['signInWithEmailAndPassword']>(),
    createUserWithEmailAndPassword: vi.fn<AuthModule['createUserWithEmailAndPassword']>(),
    signOut: vi.fn<AuthModule['signOut']>(async () => undefined),
    GoogleAuthProvider: actual.GoogleAuthProvider,
    signInWithPopup: vi.fn<AuthModule['signInWithPopup']>(),
  });
});

vi.mock(import('firebase/storage'), async (importOriginal) => {
  const { stubModule } = await import('@ttt-productions/dev-standards/testing');
  return stubModule(importOriginal, {
    getStorage: vi.fn<StorageModule['getStorage']>(),
    connectStorageEmulator: vi.fn<StorageModule['connectStorageEmulator']>(),
    ref: vi.fn(),
    uploadBytes: vi.fn<StorageModule['uploadBytes']>(),
    uploadBytesResumable: vi.fn<StorageModule['uploadBytesResumable']>(),
    getDownloadURL: vi.fn<StorageModule['getDownloadURL']>(
      async () => 'https://mock-storage.example.com/file.jpg',
    ),
    deleteObject: vi.fn<StorageModule['deleteObject']>(async () => undefined),
  });
});

vi.mock(import('firebase/functions'), async (importOriginal) => {
  const { stubModule } = await import('@ttt-productions/dev-standards/testing');
  return stubModule(importOriginal, {
    getFunctions: vi.fn<FunctionsModule['getFunctions']>(),
    connectFunctionsEmulator: vi.fn<FunctionsModule['connectFunctionsEmulator']>(),
    httpsCallable: vi.fn(),
  });
});
