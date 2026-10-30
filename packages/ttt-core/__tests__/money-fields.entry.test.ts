import { describe, it, expect } from 'vitest';
import {
  PLEDGE_PAYMENT_AMOUNT_INPUT,
  SPONSORED_AUDITION_AMOUNT_INPUT,
} from '../src/constants/money-fields.js';
import { checkMoneyField } from '../src/utils/money-field.js';
import { moneyFieldSchema } from '../src/schemas/money-field.js';
import * as constants from '../src/constants/index.js';
import * as schemas from '../src/schemas/index.js';
import * as utils from '../src/utils/index.js';

describe('the money fields', () => {
  it('are exported from the constants, schemas, and utils entries both trees read', () => {
    expect(constants.SPONSORED_AUDITION_AMOUNT_INPUT).toBe(SPONSORED_AUDITION_AMOUNT_INPUT);
    expect(constants.PLEDGE_PAYMENT_AMOUNT_INPUT).toBe(PLEDGE_PAYMENT_AMOUNT_INPUT);
    expect(schemas.moneyFieldSchema).toBe(moneyFieldSchema);
    expect(utils.checkMoneyField).toBe(checkMoneyField);
  });
});
