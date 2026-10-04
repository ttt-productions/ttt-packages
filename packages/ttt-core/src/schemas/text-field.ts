import { z } from 'zod';
import { checkTextField, type TextFieldDeclaration } from '../utils/text-field.js';

/**
 * The ONE zod schema for a text field a person types: it runs the field's declaration
 * (`constants/text-fields`) through `checkTextField` — trim, min on the trimmed text, max, then the
 * format's characters — and outputs the value the field keeps, so a writer stores the parsed value
 * and never trims again. A refusal carries the field's own sentence (`textFieldRefusal`). The form
 * runs the same check on the same declaration, so the form, the wire, and the writer accept exactly
 * the same texts (ARCH-102).
 */
export function textFieldSchema(declaration: TextFieldDeclaration) {
  return z.string().transform((text, ctx) => {
    const result = checkTextField(declaration, text);
    if (result.ok) return result.value;
    ctx.addIssue({ code: 'custom', message: result.reason, input: text });
    return z.NEVER;
  });
}
