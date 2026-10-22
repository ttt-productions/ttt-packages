import ts from 'typescript';

const blank = (chars: string[], from: number, to: number) => {
  for (let i = from; i < to; i += 1) if (chars[i] !== '\n' && chars[i] !== '\r') chars[i] = ' ';
};

export function stripCodeComments(sourceFile: ts.SourceFile): string {
  const text = sourceFile.text;
  const chars = text.split('');
  // Every comment sits in the leading trivia of the token after it (the end-of-file token holds the
  // last ones). JSX text is not trivia, so a `//` inside it is text, never a comment.
  const visit = (node: ts.Node) => {
    if (node.kind >= ts.SyntaxKind.FirstJSDocNode && node.kind <= ts.SyntaxKind.LastJSDocNode)
      return;
    const children = node.getChildren(sourceFile);
    if (children.length) {
      for (const child of children) visit(child);
      return;
    }
    if (ts.isJsxText(node)) return;
    const start = node.getStart(sourceFile);
    if (node.getFullStart() === start) return;
    // A comment on the previous token's line is a trailing range; the rest are leading ranges.
    const pos = node.getFullStart();
    for (const range of [
      ...(ts.getTrailingCommentRanges(text, pos) ?? []),
      ...(ts.getLeadingCommentRanges(text, pos) ?? []),
    ]) {
      if (range.end <= start) blank(chars, range.pos, range.end);
    }
  };
  visit(sourceFile);
  return chars.join('');
}

export function stripStylesheetComments(text: string): string {
  const chars = text.split('');
  let quote: string | null = null;
  for (let i = 0; i < chars.length; i += 1) {
    const c = chars[i];
    if (quote) {
      if (c === '\\') i += 1;
      else if (c === quote) quote = null;
    } else if (c === '"' || c === "'") {
      quote = c;
    } else if (c === '/' && chars[i + 1] === '*') {
      const close = text.indexOf('*/', i + 2);
      const end = close === -1 ? chars.length : close + 2;
      blank(chars, i, end);
      i = end - 1;
    }
  }
  return chars.join('');
}

// Rules have no regular-expression literal and no template, so quotes are the only text that can
// hold a comment marker.
export function stripRulesComments(text: string): string {
  const chars = text.split('');
  let quote: string | null = null;
  for (let i = 0; i < chars.length; i += 1) {
    const c = chars[i];
    if (quote) {
      if (c === '\\') i += 1;
      else if (c === quote || c === '\n') quote = null;
    } else if (c === '"' || c === "'") {
      quote = c;
    } else if (c === '/' && chars[i + 1] === '/') {
      let end = text.indexOf('\n', i);
      if (end === -1) end = chars.length;
      blank(chars, i, end);
      i = end - 1;
    } else if (c === '/' && chars[i + 1] === '*') {
      const close = text.indexOf('*/', i + 2);
      const end = close === -1 ? chars.length : close + 2;
      blank(chars, i, end);
      i = end - 1;
    }
  }
  return chars.join('');
}
