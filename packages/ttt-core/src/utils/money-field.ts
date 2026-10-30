import {
  checkMoneyCents,
  formatMoney,
  type DeclaredMoneyFormat,
  type MoneyAmountIssue,
} from '@ttt-productions/input-format-core';

export type MoneyFieldDeclaration = DeclaredMoneyFormat & { readonly label: string };

export function moneyFieldRefusal(declaration: MoneyFieldDeclaration, issue: MoneyAmountIssue) {
  const { label } = declaration;
  if (issue === 'tooSmall')
    return `${label} must be at least ${formatMoney(declaration.minCents)}.`;
  if (issue === 'tooLarge') return `${label} cannot exceed ${formatMoney(declaration.maxCents)}.`;
  return `${label} must be a whole number of cents.`;
}

export type MoneyFieldResult =
  { readonly ok: true; readonly cents: number } | { readonly ok: false; readonly reason: string };

export function checkMoneyField(
  declaration: MoneyFieldDeclaration,
  cents: number,
): MoneyFieldResult {
  const result = checkMoneyCents(cents, declaration);
  if (result.ok) return { ok: true, cents };
  return { ok: false, reason: moneyFieldRefusal(declaration, result.issue) };
}
