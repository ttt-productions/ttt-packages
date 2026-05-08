import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { buildFirebaseDownloadUrl } from "../src/server/build-download-url.js";

describe("buildFirebaseDownloadUrl", () => {
  let originalEnv: string | undefined;

  beforeEach(() => {
    originalEnv = process.env.FIREBASE_STORAGE_EMULATOR_HOST;
  });

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.FIREBASE_STORAGE_EMULATOR_HOST;
    } else {
      process.env.FIREBASE_STORAGE_EMULATOR_HOST = originalEnv;
    }
  });

  it("uses production hostname when emulator env var is unset", () => {
    delete process.env.FIREBASE_STORAGE_EMULATOR_HOST;
    const url = buildFirebaseDownloadUrl(
      "ttt-dev-cfb70.firebasestorage.app",
      "userProfiles/abc/profile-picture/full.jpg",
      "tok-123"
    );
    expect(url).toBe(
      "https://firebasestorage.googleapis.com/v0/b/ttt-dev-cfb70.firebasestorage.app/o/userProfiles%2Fabc%2Fprofile-picture%2Ffull.jpg?alt=media&token=tok-123"
    );
  });

  it("uses emulator host when env var is set", () => {
    process.env.FIREBASE_STORAGE_EMULATOR_HOST = "127.0.0.1:9199";
    const url = buildFirebaseDownloadUrl(
      "ttt-dev-cfb70.firebasestorage.app",
      "userProfiles/abc/profile-picture/full.jpg",
      "tok-123"
    );
    expect(url).toBe(
      "http://127.0.0.1:9199/v0/b/ttt-dev-cfb70.firebasestorage.app/o/userProfiles%2Fabc%2Fprofile-picture%2Ffull.jpg?alt=media&token=tok-123"
    );
  });

  it("encodes path segments correctly", () => {
    delete process.env.FIREBASE_STORAGE_EMULATOR_HOST;
    const url = buildFirebaseDownloadUrl(
      "bucket",
      "folder with spaces/sub/file.jpg",
      "t"
    );
    expect(url).toContain(
      "/o/folder%20with%20spaces%2Fsub%2Ffile.jpg?alt=media&token=t"
    );
  });
});
