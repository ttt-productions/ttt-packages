// What a code file imports, as the cross-root guards read it: every module the one import reader
// sees, mocks left out, each with its line and whether it is type-only.

import type { FileView } from '../../reader/view.js';
import { moduleImports, type ImportKind } from '../../support/imports.js';

export interface ModuleSpecifier {
  spec: string;
  line: number;
  /** True for `import type`, `export type … from`, and a type-position `import()`. */
  typeOnly: boolean;
}

const NAMED_MODULES: readonly ImportKind[] = [
  'import',
  'export',
  'importEquals',
  'dynamic',
  'require',
  'importType',
];

/** Every module specifier a code file names, in source order. */
export function moduleSpecifiers(file: FileView): ModuleSpecifier[] {
  return moduleImports(file.sourceFile, NAMED_MODULES).map(({ spec, node, typeOnly }) => ({
    spec,
    line: file.lineOf(node.getStart(file.sourceFile)),
    typeOnly,
  }));
}
