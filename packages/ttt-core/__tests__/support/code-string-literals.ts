// Honest string-literal scanner for the ttt-core structural guards.
//
// A guard that greps raw file text cannot tell a declaration from prose: it fires on a
// member name inside a JSDoc sentence, and it has to be silenced with a whole-file
// allowlist that then hides every real re-declaration in that file. This module parses
// each file with the TypeScript compiler API instead, so comments are not part of the
// scan at all, and reports each literal together with the top-level declaration it sits
// in — the unit a guard allowlist can name.
//
// Only literals whose ENTIRE text is the value count: `'x'`, `"x"` and `` `x` ``. An
// interpolated template (`` `x/${id}` ``) builds a string, it does not declare a member.

import ts from 'typescript';

/** Declaration name reported for a literal outside any named top-level declaration. */
export const MODULE_SCOPE = '<module>';

export interface CodeStringLiteral {
  /** The literal's text with quotes stripped. */
  readonly value: string;
  /** The enclosing top-level declaration's name, or {@link MODULE_SCOPE}. */
  readonly declaration: string;
  /** 1-based line number of the literal. */
  readonly line: number;
}

function declarationName(statement: ts.Statement): string {
  if (ts.isVariableStatement(statement)) {
    const names = statement.declarationList.declarations.flatMap((declaration) =>
      ts.isIdentifier(declaration.name) ? [declaration.name.text] : [],
    );
    return names.length > 0 ? names.join(', ') : MODULE_SCOPE;
  }
  if (
    ts.isFunctionDeclaration(statement) ||
    ts.isClassDeclaration(statement) ||
    ts.isInterfaceDeclaration(statement) ||
    ts.isTypeAliasDeclaration(statement) ||
    ts.isEnumDeclaration(statement) ||
    ts.isModuleDeclaration(statement)
  ) {
    return statement.name !== undefined && ts.isIdentifier(statement.name)
      ? statement.name.text
      : MODULE_SCOPE;
  }
  return MODULE_SCOPE;
}

function isWholeStringLiteral(node: ts.Node): node is ts.StringLiteral | ts.NoSubstitutionTemplateLiteral {
  return ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node);
}

/** Every string literal written in CODE, with the top-level declaration it belongs to. */
export function collectCodeStringLiterals(fileName: string, sourceText: string): CodeStringLiteral[] {
  const sourceFile = ts.createSourceFile(
    fileName,
    sourceText,
    ts.ScriptTarget.Latest,
    /* setParentNodes */ true,
    fileName.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );

  const found: CodeStringLiteral[] = [];
  for (const statement of sourceFile.statements) {
    const declaration = declarationName(statement);
    const visit = (node: ts.Node): void => {
      if (isWholeStringLiteral(node)) {
        found.push({
          value: node.text,
          declaration,
          line: sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1,
        });
      }
      ts.forEachChild(node, visit);
    };
    visit(statement);
  }
  return found;
}

/** One reviewed non-owner occurrence: the file, the top-level declaration, and why it is legitimate. */
export interface AllowedOccurrence {
  readonly file: string;
  readonly declaration: string;
  readonly why: string;
}

export interface GuardedLiteral {
  /**
   * Defining file(s), packages-dir-relative and forward-slashed. A literal in its own
   * defining file IS the declaration, so owners stay file-scoped; more than one owner
   * means two genuinely different canonical unions share the spelling.
   */
  readonly owners: readonly string[];
  /** Compiler-checked derived usages elsewhere — declaration-scoped, never whole files. */
  readonly allowed?: readonly AllowedOccurrence[];
}

/** Whether a rule excuses an occurrence — as an owner-file declaration or a reviewed entry. */
export function isExcusedOccurrence(
  occurrence: { readonly file: string; readonly declaration: string },
  rule: GuardedLiteral,
): boolean {
  if (rule.owners.includes(occurrence.file)) return true;
  return (rule.allowed ?? []).some(
    (entry) => entry.file === occurrence.file && entry.declaration === occurrence.declaration,
  );
}
