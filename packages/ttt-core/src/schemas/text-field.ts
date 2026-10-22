import { z } from 'zod';
import { checkTextField, type TextFieldDeclaration } from '../utils/text-field.js';

export function textFieldSchema(declaration: TextFieldDeclaration) {
  return z.string().transform((text, ctx) => {
    const result = checkTextField(declaration, text);
    if (result.ok) return result.value;
    ctx.addIssue({ code: 'custom', message: result.reason, input: text });
    return z.NEVER;
  });
}
