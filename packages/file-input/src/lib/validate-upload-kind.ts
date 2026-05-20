import { getSimplifiedMediaType } from '@ttt-productions/media-schemas';
import { ensureFileWithContentType } from './infer-content-type.js';

type SingleKind = 'image' | 'video' | 'audio';
export type ExpectedKind = SingleKind | 'any' | readonly SingleKind[];

/**
 * Diagnostic codes emitted by validateAndNormalizeUploadFile when validation
 * fails. Consumers can route these to monitoring/Sentry via the onError option.
 */
export type ValidateUploadFileErrorCode =
  | 'upload_kind_indeterminate'
  | 'upload_kind_mismatch';

export interface ValidateUploadFileOptions {
  /**
   * Optional diagnostic callback fired before the function throws.
   * Useful for routing to Sentry / monitoring-core. The thrown Error
   * carries the user-facing message; this callback gets the machine
   * code + structured extras.
   */
  onError?: (code: ValidateUploadFileErrorCode, extra: {
    fileOrigin: string;
    expectedKind: string;
    detectedKind?: SingleKind | 'other';
    fileName: string;
    fileSize: number;
    fileType: string;
  }) => void;
}

function describeExpected(expected: ExpectedKind): string {
  if (expected === 'any') return 'image, video, or audio';
  if (Array.isArray(expected)) return expected.join(' or ');
  return expected as string;
}

function matchesExpected(detected: SingleKind, expected: ExpectedKind): boolean {
  if (expected === 'any') return true;
  if (Array.isArray(expected)) return (expected as readonly SingleKind[]).includes(detected);
  return detected === expected;
}

/**
 * Validates and normalizes a file for upload.
 *
 * - Throws a user-friendly Error if the file's kind cannot be determined.
 * - Throws a user-friendly Error if `expectedKind` is not 'any' and doesn't
 *   match the detected kind.
 * - Otherwise returns a File with a guaranteed valid media contentType.
 *
 * Optional `onError` callback fires with a machine-readable code + structured
 * extras before the throw, so consumers can route to monitoring without this
 * package depending on any monitoring library.
 *
 * Use this at the top of every upload mutation, before uploadFileResumable.
 */
export function validateAndNormalizeUploadFile(
  file: File,
  fileOrigin: string,
  expectedKind: ExpectedKind,
  options?: ValidateUploadFileOptions,
): File {
  const detected = getSimplifiedMediaType(file);

  if (detected === 'other') {
    options?.onError?.('upload_kind_indeterminate', {
      fileOrigin,
      expectedKind: describeExpected(expectedKind),
      detectedKind: detected,
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
    });
    throw new Error(
      'Could not determine the file type. Please try a different file or re-export it in a common format.'
    );
  }

  if (!matchesExpected(detected, expectedKind)) {
    options?.onError?.('upload_kind_mismatch', {
      fileOrigin,
      expectedKind: describeExpected(expectedKind),
      detectedKind: detected,
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
    });
    throw new Error(
      `This slot only accepts ${describeExpected(expectedKind)} files. The selected file is ${detected}.`
    );
  }

  return ensureFileWithContentType(file, detected);
}
