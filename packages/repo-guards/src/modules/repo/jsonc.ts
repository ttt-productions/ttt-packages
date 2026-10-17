// JSON that may carry comments and trailing commas, as tsconfig files do. Scanned character by
// character so a comment delimiter inside a string (`"@/*"`, `"**/*.ts"`) stays part of the string.

export function parseJsonc(text: string): unknown {
  let out = '';
  let index = 0;
  let inString = false;
  while (index < text.length) {
    const char = text[index];
    if (inString) {
      out += char;
      if (char === '\\') {
        out += text[index + 1] ?? '';
        index += 2;
        continue;
      }
      if (char === '"') inString = false;
      index += 1;
      continue;
    }
    if (char === '"') {
      inString = true;
      out += char;
      index += 1;
      continue;
    }
    if (char === '/' && text[index + 1] === '/') {
      while (index < text.length && text[index] !== '\n') index += 1;
      continue;
    }
    if (char === '/' && text[index + 1] === '*') {
      index += 2;
      while (index < text.length && !(text[index] === '*' && text[index + 1] === '/')) index += 1;
      index += 2;
      continue;
    }
    out += char;
    index += 1;
  }
  return JSON.parse(out.replace(/,(\s*[}\]])/g, '$1'));
}
