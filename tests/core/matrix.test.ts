import { describe, expect, it } from 'vitest';
import { buildMatrix } from '@/core/matrix';
import { bnplMachine, build } from './fixtures';

describe('buildMatrix', () => {
  it('matches Appendix E.4 on the fixture', () => {
    expect(buildMatrix(bnplMachine())).toEqual([
      { stateId: 's_cart', label: 'Cart', timeout: 'na', failure: 'na', cancel: 'na', duplicate: 'na' },
      { stateId: 's_checkout', label: 'Checkout Review', timeout: 'na', failure: 'na', cancel: 'missing', duplicate: 'missing' },
      { stateId: 's_credit_check', label: 'Credit Check', timeout: 'missing', failure: 'missing', cancel: 'missing', duplicate: 'na' },
      { stateId: 's_confirm', label: 'Confirm Plan', timeout: 'na', failure: 'na', cancel: 'handled', duplicate: 'missing' },
      { stateId: 's_credit_declined', label: 'Credit Declined', timeout: 'na', failure: 'na', cancel: 'na', duplicate: 'na' },
    ]);
  });

  it('has no rows without exactly one initial state', () => {
    expect(buildMatrix(build([['s_a'], ['s_b']], []))).toEqual([]);
    expect(buildMatrix(build([['s_a', { initial: true }], ['s_b', { initial: true }]], []))).toEqual([]);
  });
});
