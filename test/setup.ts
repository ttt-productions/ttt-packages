import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock firebase modules for all packages
vi.mock('firebase/app', () => ({
  initializeApp: vi.fn(() => ({})),
  getApps: vi.fn(() => []),
  getApp: vi.fn(() => ({})),
}));

vi.mock('firebase/firestore', () => ({
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
  writeBatch: vi.fn(() => ({
    set: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    commit: vi.fn().mockResolvedValue(undefined),
  })),
  serverTimestamp: vi.fn(() => ({ _type: 'serverTimestamp' })),
  Timestamp: {
    now: vi.fn(() => ({ seconds: 0, nanoseconds: 0, toDate: () => new Date() })),
    fromDate: vi.fn((d: Date) => ({ seconds: Math.floor(d.getTime() / 1000), nanoseconds: 0 })),
  },
  connectFirestoreEmulator: vi.fn(),
  arrayUnion: vi.fn((...items: unknown[]) => ({ _type: 'arrayUnion', items })),
  arrayRemove: vi.fn((...items: unknown[]) => ({ _type: 'arrayRemove', items })),
  increment: vi.fn((n: number) => ({ _type: 'increment', n })),
  documentId: vi.fn(() => '__name__'),
  startAfter: vi.fn(),
  endBefore: vi.fn(),
}));

vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(),
  connectAuthEmulator: vi.fn(),
  onAuthStateChanged: vi.fn(() => vi.fn()),
  signInWithEmailAndPassword: vi.fn(),
  createUserWithEmailAndPassword: vi.fn(),
  signOut: vi.fn().mockResolvedValue(undefined),
  GoogleAuthProvider: vi.fn(() => ({})),
  signInWithPopup: vi.fn(),
}));

vi.mock('firebase/storage', () => ({
  getStorage: vi.fn(),
  connectStorageEmulator: vi.fn(),
  ref: vi.fn(),
  uploadBytes: vi.fn().mockResolvedValue({ ref: {} }),
  uploadBytesResumable: vi.fn(() => ({
    on: vi.fn(),
    snapshot: { bytesTransferred: 0, totalBytes: 100 },
    cancel: vi.fn(),
  })),
  getDownloadURL: vi.fn().mockResolvedValue('https://mock-storage.example.com/file.jpg'),
  deleteObject: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('firebase/functions', () => ({
  getFunctions: vi.fn(),
  connectFunctionsEmulator: vi.fn(),
  httpsCallable: vi.fn(() => vi.fn().mockResolvedValue({ data: {} })),
}));
