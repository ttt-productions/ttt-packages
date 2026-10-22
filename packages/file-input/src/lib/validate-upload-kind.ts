import { getSimplifiedMediaType } from '@ttt-productions/media-schemas';
import { ensureFileWithContentType } from './infer-content-type.js';

type SingleKind = 'image' | 'video' | 'audio';
export type ExpectedKind = SingleKind | 'any' | readonly SingleKind[];

export type ValidateUploadFileErrorCode = 'upload_kind_indeterminate' | 'upload_kind_mismatch';

export interface ValidateUploadFileOptions {
  onError?: (
    code: ValidateUploadFileErrorCode,
    extra: {
      fileOrigin: string;
      expectedKind: string;
      detectedKind?: SingleKind | 'other';
      fileName: string;
      fileSize: number;
      fileType: string;
    },
  ) => void;
  allowIndeterminate?: boolean;
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

export function validateAndNormalizeUploadFile(
  file: File,
  fileOrigin: string,
  expectedKind: ExpectedKind,
  options?: ValidateUploadFileOptions,
): File {
  const detected = getSimplifiedMediaType(file);

  if (detected === 'other') {
    if (options?.allowIndeterminate === true) {
      return ensureFileWithContentType(file);
    }
    options?.onError?.('upload_kind_indeterminate', {
      fileOrigin,
      expectedKind: describeExpected(expectedKind),
      detectedKind: detected,
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
    });
    throw new Error(
      'Could not determine the file type. Please try a different file or re-export it in a common format.',
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
      `This slot only accepts ${describeExpected(expectedKind)} files. The selected file is ${detected}.`,
    );
  }

  return ensureFileWithContentType(file, detected);
}
