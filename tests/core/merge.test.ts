import { describe, expect, it } from 'vitest';
import { runChecks } from '@/core/checker';
import { mergeFindings } from '@/core/merge';
import type { Finding } from '@/core/types';
import { bnplMachine } from './fixtures';

const ai = (n: number, severity: Finding['severity']): Finding => ({
  id: `f_ai_${n}`,
  source: 'ai',
  ruleId: 'AI_GAP',
  severity,
  category: 'business_rule',
  title: `AI ${n}`,
  description: '',
  stateIds: ['s_cart'],
  question: { text: 'Q?', options: ['A', 'B'] },
});

describe('mergeFindings', () => {
  it('sorts by severity, then checker before ai, and keeps AI order within a severity', () => {
    const checker = runChecks(bnplMachine());
    const merged = mergeFindings(checker, [ai(1, 'high'), ai(2, 'medium'), ai(3, 'low'), ai(4, 'high')]);
    expect(merged.map((f) => f.id)).toEqual([
      'f_dead_end_state_s_credit_declined',
      'f_missing_handler_s_credit_check_timeout',
      'f_missing_handler_s_credit_check_failure',
      'f_ai_1',
      'f_ai_4',
      'f_no_failure_terminal_machine',
      'f_unreachable_state_s_referral',
      'f_missing_handler_s_checkout_cancel',
      'f_missing_handler_s_checkout_duplicate',
      'f_missing_handler_s_credit_check_cancel',
      'f_missing_handler_s_confirm_duplicate',
      'f_ai_2',
      'f_ai_3',
    ]);
  });

  it('orders checker findings by rule order within a severity', () => {
    const checker = runChecks(bnplMachine());
    const shuffled = [...checker].reverse();
    expect(mergeFindings(shuffled, []).map((f) => f.ruleId)).toEqual([
      'DEAD_END_STATE', 'MISSING_HANDLER', 'MISSING_HANDLER',
      'NO_FAILURE_TERMINAL', 'UNREACHABLE_STATE', 'MISSING_HANDLER', 'MISSING_HANDLER', 'MISSING_HANDLER', 'MISSING_HANDLER',
    ]);
  });

  it('does not change its inputs', () => {
    const checker = runChecks(bnplMachine());
    const copy = [...checker];
    mergeFindings(checker, [ai(1, 'high')]);
    expect(checker).toEqual(copy);
  });
});
