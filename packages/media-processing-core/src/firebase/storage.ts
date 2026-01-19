// functions-only helpers for firebase-admin storage
// kept minimal so handlers stay thin
import { joinPath } from "@ttt-productions/firebase-helpers";

export function buildStoragePath(
    basePath: string,
    filename: string
  ): string {
    return joinPath(basePath, filename);
}