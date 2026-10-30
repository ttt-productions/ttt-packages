import { z } from 'zod';
import { checkMoneyField, type MoneyFieldDeclaration } from '../utils/money-field.js';

export function moneyFieldSchema(declaration: MoneyFieldDeclaration) {
  return z.number().superRefine((cents, ctx) => {
    const result = checkMoneyField(declaration, cents);
    if (!result.ok) ctx.addIssue({ code: 'custom', message: result.reason, input: cents });
  });
}
