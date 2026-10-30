import { defineMoneyFormat } from '@ttt-productions/input-format-core';
import type { MoneyFieldDeclaration } from '../utils/money-field.js';
import { MAX_SPONSORED_AUDITION_AMOUNT_CENTS } from './business-content.js';
import {
  MAX_PLEDGE_PAYMENT_AMOUNT_CENTS,
  MIN_PLEDGE_PAYMENT_AMOUNT_CENTS,
} from './business-platform.js';

export const SPONSORED_AUDITION_AMOUNT_INPUT: MoneyFieldDeclaration = defineMoneyFormat({
  label: 'Work Project Amount',
  minCents: 0,
  maxCents: MAX_SPONSORED_AUDITION_AMOUNT_CENTS,
});

export const PLEDGE_PAYMENT_AMOUNT_INPUT: MoneyFieldDeclaration = defineMoneyFormat({
  label: 'Pledge amount',
  minCents: MIN_PLEDGE_PAYMENT_AMOUNT_CENTS,
  maxCents: MAX_PLEDGE_PAYMENT_AMOUNT_CENTS,
});
