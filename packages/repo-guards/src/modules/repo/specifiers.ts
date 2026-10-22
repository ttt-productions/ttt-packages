import type { FileView } from '../../reader/view.js';
import { moduleImports, type ImportKind } from '../../support/imports.js';

export interface ModuleSpecifier {
  spec: string;
  line: number;
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

export function moduleSpecifiers(file: FileView): ModuleSpecifier[] {
  return moduleImports(file.sourceFile, NAMED_MODULES).map(({ spec, node, typeOnly }) => ({
    spec,
    line: file.lineOf(node.getStart(file.sourceFile)),
    typeOnly,
  }));
}
