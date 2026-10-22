import ts from 'typescript';
import { kindOfFile, type FileKind, type RootRole } from '../node/layout.js';
import { moduleImports, type ModuleImport } from '../support/imports.js';
import {
  stripCodeComments,
  stripRulesComments,
  stripStylesheetComments,
} from './strip-comments.js';

export type FileRole = RootRole | 'installed' | 'repository';

export interface FileView {
  readonly path: string;
  readonly role: FileRole;
  readonly rootName: string;
  readonly kind: FileKind;
  readonly isTest: boolean;
  readonly text: string;
  readonly code: string;
  readonly sourceFile: ts.SourceFile;
  readonly imports: readonly ModuleImport[];
  lineOf(index: number): number;
}

function scriptKindOf(file: string): ts.ScriptKind {
  if (file.endsWith('.tsx')) return ts.ScriptKind.TSX;
  if (file.endsWith('.jsx')) return ts.ScriptKind.JSX;
  if (/\.[cm]?js$/.test(file)) return ts.ScriptKind.JS;
  return ts.ScriptKind.TS;
}

function lineStartsOf(text: string): number[] {
  const starts = [0];
  for (let i = 0; i < text.length; i += 1) if (text.charCodeAt(i) === 10) starts.push(i + 1);
  return starts;
}

export function buildView(input: {
  path: string;
  role: FileRole;
  rootName: string;
  kind: FileKind;
  isTest: boolean;
  load: () => string;
}): FileView {
  const { path: rel, kind, load } = input;
  let text: string | undefined;
  let code: string | undefined;
  let sourceFile: ts.SourceFile | undefined;
  let lineStarts: readonly number[] | undefined;
  const readText = () => (text ??= load());
  const parse = () => {
    if (!sourceFile) {
      if (kind !== 'code' && kind !== 'declarations')
        throw new Error(`repo-guards: ${rel} is ${kind}, not code`);
      sourceFile = ts.createSourceFile(
        rel,
        readText(),
        ts.ScriptTarget.Latest,
        true,
        scriptKindOf(rel),
      );
    }
    return sourceFile;
  };
  return {
    path: rel,
    role: input.role,
    rootName: input.rootName,
    kind,
    isTest: input.isTest,
    get text() {
      return readText();
    },
    get code() {
      if (code === undefined) {
        if (kind === 'code' || kind === 'declarations') code = stripCodeComments(parse());
        else if (kind === 'stylesheet') code = stripStylesheetComments(readText());
        else if (kind === 'rules') code = stripRulesComments(readText());
        else code = readText();
      }
      return code;
    },
    get sourceFile() {
      return parse();
    },
    get imports() {
      return moduleImports(parse());
    },
    lineOf(index: number) {
      const starts = (lineStarts ??= lineStartsOf(readText()));
      let lo = 0;
      let hi = starts.length - 1;
      while (lo < hi) {
        const mid = (lo + hi + 1) >> 1;
        if (starts[mid] <= index) lo = mid;
        else hi = mid - 1;
      }
      return lo + 1;
    },
  };
}

export function viewOfText(
  relPath: string,
  text: string,
  { isTest }: { isTest?: boolean } = {},
): FileView {
  const kind = kindOfFile(relPath.slice(relPath.lastIndexOf('/') + 1));
  if (!kind) throw new Error(`repo-guards: ${relPath} is no kind of file a guard reads`);
  return buildView({
    path: relPath,
    role: 'app',
    rootName: '(sample)',
    kind,
    isTest: isTest ?? /\.(test|spec)\./.test(relPath),
    load: () => text,
  });
}
