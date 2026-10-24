import type { IdTokenResult, ParsedToken, User } from 'firebase/auth';

const notInThisFake = (what: string): never => {
  throw new Error(`${what} is not part of this fake`);
};

export function idTokenResult(claims: ParsedToken): IdTokenResult {
  return {
    authTime: '',
    expirationTime: '',
    issuedAtTime: '',
    signInProvider: null,
    signInSecondFactor: null,
    token: 'test-token',
    claims,
  };
}

export function testUser(uid: string, overrides: Partial<User> = {}): User {
  return {
    uid,
    emailVerified: false,
    isAnonymous: false,
    metadata: {},
    providerData: [],
    refreshToken: '',
    tenantId: null,
    displayName: null,
    email: null,
    phoneNumber: null,
    photoURL: null,
    providerId: 'firebase',
    delete: () => notInThisFake('delete'),
    getIdToken: () => notInThisFake('getIdToken'),
    getIdTokenResult: () => notInThisFake('getIdTokenResult'),
    reload: () => notInThisFake('reload'),
    toJSON: () => notInThisFake('toJSON'),
    ...overrides,
  };
}
