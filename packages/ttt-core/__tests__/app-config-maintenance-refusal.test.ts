import { describe, it, expect } from 'vitest';
import {
  DEFAULT_MAINTENANCE_MESSAGE,
  MAINTENANCE_REFUSAL_CODE,
  MAINTENANCE_REFUSAL_REASON,
  isMaintenanceRefusalDetails,
  isMaintenanceRefusalError,
  type MaintenanceRefusalDetails,
} from '../src/utils/app-config';
import * as root from '../src/index';
import * as utils from '../src/utils';

const details: MaintenanceRefusalDetails = { reason: MAINTENANCE_REFUSAL_REASON };

describe('the callable maintenance refusal — one recognisable shape', () => {
  it('is an unavailable refusal whose details carry the maintenance reason', () => {
    expect(MAINTENANCE_REFUSAL_CODE).toBe('unavailable');
    expect(MAINTENANCE_REFUSAL_REASON).toBe('maintenance');
  });

  it.each(['unavailable', 'functions/unavailable'])(
    'recognises the %s spelling carrying the maintenance details',
    (code) => {
      expect(isMaintenanceRefusalError({ code, message: 'Back at noon.', details })).toBe(true);
    },
  );

  it('recognises an Error instance carrying the code and details, whatever its message', () => {
    const err = Object.assign(new Error('Anything the operator typed.'), { code: MAINTENANCE_REFUSAL_CODE, details });
    expect(isMaintenanceRefusalError(err)).toBe(true);
  });

  it('recognises details that carry more than the reason', () => {
    expect(isMaintenanceRefusalError({ code: 'unavailable', details: { reason: 'maintenance', extra: 1 } })).toBe(true);
  });

  it.each(['failed-precondition', 'functions/failed-precondition', 'internal', 'functions/internal', 'UNAVAILABLE', ''])(
    'rejects the maintenance details under the %s code',
    (code) => {
      expect(isMaintenanceRefusalError({ code, details })).toBe(false);
    },
  );

  it('rejects details without a code', () => {
    expect(isMaintenanceRefusalError({ details })).toBe(false);
    expect(isMaintenanceRefusalError({ code: 503, details })).toBe(false);
  });

  it.each<[string, unknown]>([
    ['absent', undefined],
    ['null', null],
    ['the reason as a bare string', MAINTENANCE_REFUSAL_REASON],
    ['another refusal reason', { reason: 'acceptance-required' }],
    ['a differently-cased reason', { reason: 'Maintenance' }],
    ['no reason', {}],
  ])('rejects an unavailable error whose details are %s — a genuine outage', (_label, junk) => {
    expect(isMaintenanceRefusalError({ code: 'unavailable', details: junk })).toBe(false);
    expect(isMaintenanceRefusalError({ code: 'functions/unavailable', details: junk })).toBe(false);
  });

  it('rejects a message-only error, even one carrying the maintenance line', () => {
    expect(isMaintenanceRefusalError(new Error(DEFAULT_MAINTENANCE_MESSAGE))).toBe(false);
    expect(isMaintenanceRefusalError({ code: 'unavailable', message: DEFAULT_MAINTENANCE_MESSAGE })).toBe(false);
  });

  it.each<[string, unknown]>([
    ['undefined', undefined],
    ['null', null],
    ['the code as a string', 'unavailable'],
    ['a number', 503],
    ['a boolean', true],
    ['a function', () => ({ code: 'unavailable', details })],
  ])('rejects a non-object: %s', (_label, junk) => {
    expect(isMaintenanceRefusalError(junk)).toBe(false);
  });
});

describe('isMaintenanceRefusalDetails', () => {
  it('accepts details naming the maintenance reason', () => {
    expect(isMaintenanceRefusalDetails(details)).toBe(true);
  });

  it.each<[string, unknown]>([
    ['undefined', undefined],
    ['null', null],
    ['a string', 'maintenance'],
    ['another reason', { reason: 'email-verification-required' }],
    ['no reason', { message: DEFAULT_MAINTENANCE_MESSAGE }],
  ])('rejects %s', (_label, junk) => {
    expect(isMaintenanceRefusalDetails(junk)).toBe(false);
  });
});

describe('the maintenance refusal exports', () => {
  it('ship beside DEFAULT_MAINTENANCE_MESSAGE from the package root and the utils subpath', () => {
    expect(root.MAINTENANCE_REFUSAL_CODE).toBe(MAINTENANCE_REFUSAL_CODE);
    expect(root.MAINTENANCE_REFUSAL_REASON).toBe(MAINTENANCE_REFUSAL_REASON);
    expect(root.isMaintenanceRefusalDetails).toBe(isMaintenanceRefusalDetails);
    expect(root.isMaintenanceRefusalError).toBe(isMaintenanceRefusalError);
    expect(utils.isMaintenanceRefusalError).toBe(isMaintenanceRefusalError);
    expect(utils.isMaintenanceRefusalDetails).toBe(isMaintenanceRefusalDetails);
  });
});
