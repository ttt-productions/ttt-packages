import { z } from 'zod';
import { checkPhoneDigits } from '@ttt-productions/input-format-core';
import {
  checkPhoneField,
  phoneFieldRefusal,
  type PhoneFieldDeclaration,
} from '../utils/phone-field.js';

export function phoneFieldSchema(declaration: PhoneFieldDeclaration & { readonly required: true }) {
  return z.string().transform((text, ctx) => {
    const result = checkPhoneField(declaration, text);
    if (result.ok && result.digits !== null) return result.digits;
    ctx.addIssue({
      code: 'custom',
      message: result.ok ? phoneFieldRefusal(declaration, 'missing') : result.reason,
      input: text,
    });
    return z.NEVER;
  });
}

export function storedPhoneFieldSchema(declaration: PhoneFieldDeclaration) {
  return z.string().superRefine((digits, ctx) => {
    const result = checkPhoneDigits(digits, declaration);
    if (!result.ok) {
      ctx.addIssue({
        code: 'custom',
        message: phoneFieldRefusal(declaration, result.issue),
        input: digits,
      });
    }
  });
}
