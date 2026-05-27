import { createKeyScope } from '@ttt-productions/query-core';

/**
 * TTT-specific query-key scopes. Composed via createKeyScope from query-core,
 * which keeps the key-builder mechanism in the generic package and the
 * TTT-vocabulary scopes in ttt-core.
 *
 * Convention:
 * - tttKeys.craftSkills.all => ['craftSkills']
 * - tttKeys.craftSkills.detail(id) => ['craftSkills', 'detail', id]
 * - tttKeys.craftSkills.list(param?) => ['craftSkills', 'list', param?]
 * - tttKeys.craftSkills.custom('list', filter) => ['craftSkills', 'list', filter]
 */
export const tttKeys = {
  craftSkills: createKeyScope('craftSkills'),
  thresholdLibrary: createKeyScope('thresholdLibrary'),
  hallLibrary: createKeyScope('hallLibrary'),
  auditionBoard: createKeyScope('auditionBoard'),
  commissionListings: createKeyScope('commissionListings'),
  pledgePayments: createKeyScope('pledgePayments'),
  futurePlans: createKeyScope('futurePlans'),
  rulesAndAgreements: createKeyScope('rulesAndAgreements'),
  violations: createKeyScope('violations'),
} as const;
