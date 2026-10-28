import { describe, expect, it } from 'vitest';
import { runChecks } from '@/core/checker';
import { FindingSchema } from '@/core/types';
import { bnplMachine, build } from './fixtures';

const rules = (findings: { ruleId: string }[]) => findings.map((f) => f.ruleId);

describe('runChecks', () => {
  it('gives exactly the 9 Appendix E findings on the fixture, in order', () => {
    const findings = runChecks(bnplMachine());
    expect(findings.map((f) => [f.id, f.ruleId, f.severity, f.stateIds, f.requiredKind])).toEqual([
      ['f_dead_end_state_s_credit_declined', 'DEAD_END_STATE', 'high', ['s_credit_declined'], undefined],
      ['f_missing_handler_s_credit_check_timeout', 'MISSING_HANDLER', 'high', ['s_credit_check'], 'timeout'],
      ['f_missing_handler_s_credit_check_failure', 'MISSING_HANDLER', 'high', ['s_credit_check'], 'failure'],
      ['f_no_failure_terminal_machine', 'NO_FAILURE_TERMINAL', 'medium', [], undefined],
      ['f_unreachable_state_s_referral', 'UNREACHABLE_STATE', 'medium', ['s_referral'], undefined],
      ['f_missing_handler_s_checkout_cancel', 'MISSING_HANDLER', 'medium', ['s_checkout'], 'cancel'],
      ['f_missing_handler_s_checkout_duplicate', 'MISSING_HANDLER', 'medium', ['s_checkout'], 'duplicate'],
      ['f_missing_handler_s_credit_check_cancel', 'MISSING_HANDLER', 'medium', ['s_credit_check'], 'cancel'],
      ['f_missing_handler_s_confirm_duplicate', 'MISSING_HANDLER', 'medium', ['s_confirm'], 'duplicate'],
    ]);
    for (const f of findings) {
      expect(FindingSchema.safeParse(f).success).toBe(true);
      expect(f.source).toBe('checker');
      expect(f.category).toBe('structure');
      expect(f.description.length).toBeGreaterThan(0);
      expect(f.description.length).toBeLessThanOrEqual(200);
    }
  });

  it('uses the Appendix E.1 title templates', () => {
    const titles = runChecks(bnplMachine()).map((f) => f.title);
    expect(titles).toEqual([
      '"Credit Declined" is a dead end',
      'No timeout handling in "Credit Check"',
      'No failure handling in "Credit Check"',
      'No failure ending',
      '"Referral Bonus Screen" can never be reached',
      'No way to cancel from "Checkout Review"',
      'No double-submit handling in "Checkout Review"',
      'No way to cancel from "Credit Check"',
      'No double-submit handling in "Confirm Plan"',
    ]);
  });

  it('skips reachability rules when there is no initial state', () => {
    // b is a dead end, c is unreachable and a waits for outside: none of that may be reported.
    const m = build(
      [['s_a', { awaitsExternal: true }], ['s_b'], ['s_c'], ['s_d', { terminal: 'success' }]],
      [['s_a', 'e_go', 's_b']],
    );
    expect(rules(runChecks(m))).toEqual(['NO_INITIAL', 'NO_FAILURE_TERMINAL']);
    expect(runChecks(m)[0]?.title).toBe('No start state');
  });

  it('skips reachability rules when there are several initial states', () => {
    const m = build(
      [['s_a', { initial: true }], ['s_b', { initial: true, userInput: true }], ['s_c']],
      [['s_a', 'e_go', 's_c']],
    );
    const findings = runChecks(m);
    expect(rules(findings)).toEqual(['MULTIPLE_INITIAL', 'NO_SUCCESS_TERMINAL', 'NO_FAILURE_TERMINAL']);
    expect(findings[0]?.id).toBe('f_multiple_initial_machine');
    expect(findings[0]?.stateIds).toEqual(['s_a', 's_b']);
  });

  it('reports each unreachable state once, including unreachable terminals, and not reachable terminals', () => {
    const m = build(
      [['s_a', { initial: true }], ['s_ok', { terminal: 'success' }], ['s_x'], ['s_y'], ['s_lost', { terminal: 'failure' }]],
      [['s_a', 'e_go', 's_ok'], ['s_x', 'e_go', 's_y']],
    );
    const unreachable = runChecks(m).filter((f) => f.ruleId === 'UNREACHABLE_STATE');
    expect(unreachable.map((f) => f.id)).toEqual([
      'f_unreachable_state_s_x',
      'f_unreachable_state_s_y',
      'f_unreachable_state_s_lost',
    ]);
  });

  it('does not report DEAD_END_STATE and NO_PATH_TO_TERMINAL for the same state', () => {
    const m = build(
      [['s_a', { initial: true }], ['s_b'], ['s_ok', { terminal: 'success' }], ['s_bad', { terminal: 'failure' }]],
      [['s_a', 'e_go', 's_b'], ['s_a', 'e_done', 's_ok']],
    );
    const findings = runChecks(m);
    expect(rules(findings)).toEqual(['DEAD_END_STATE', 'UNREACHABLE_STATE']);
    expect(findings[0]?.stateIds).toEqual(['s_b']);
  });

  it('reports NO_PATH_TO_TERMINAL for every state of a cycle that cannot finish', () => {
    const m = build(
      [['s_a', { initial: true }], ['s_b'], ['s_c'], ['s_ok', { terminal: 'success' }], ['s_bad', { terminal: 'failure' }]],
      [['s_a', 'e_go', 's_b'], ['s_b', 'e_next', 's_c'], ['s_c', 'e_back', 's_b'], ['s_a', 'e_done', 's_ok'], ['s_a', 'e_fail', 's_bad']],
    );
    const noPath = runChecks(m).filter((f) => f.ruleId === 'NO_PATH_TO_TERMINAL');
    expect(noPath.map((f) => f.stateIds[0])).toEqual(['s_b', 's_c']);
    expect(noPath[0]?.title).toBe('"b" can never finish');
  });

  it('reports NONDETERMINISTIC when from + event lead to different targets, not when targets are equal', () => {
    const base: [string, { initial?: boolean; terminal?: 'success' | 'failure' }?][] = [
      ['s_a', { initial: true }], ['s_ok', { terminal: 'success' }], ['s_bad', { terminal: 'failure' }],
    ];
    const conflicting = runChecks(build(base, [['s_a', 'e_go', 's_ok'], ['s_a', 'e_go', 's_bad']]));
    const nd = conflicting.filter((f) => f.ruleId === 'NONDETERMINISTIC');
    expect(nd).toHaveLength(1);
    expect(nd[0]?.id).toBe('f_nondeterministic_s_a_e_go');
    expect(nd[0]?.stateIds).toEqual(['s_a']);
    expect(nd[0]?.title).toBe('"go" in "a" has conflicting outcomes');
    expect(nd[0]?.question.options).toEqual(['ok', 'bad', 'It depends on a condition (describe it)']);

    const same = runChecks(build(base, [['s_a', 'e_go', 's_ok'], ['s_a', 'e_go', 's_ok'], ['s_a', 'e_fail', 's_bad']]));
    expect(rules(same)).not.toContain('NONDETERMINISTIC');
  });

  it('gives each NONDETERMINISTIC event in the same state its own id', () => {
    const m = build(
      [['s_a', { initial: true }], ['s_ok', { terminal: 'success' }], ['s_bad', { terminal: 'failure' }]],
      [['s_a', 'e_go', 's_ok'], ['s_a', 'e_go', 's_bad'], ['s_a', 'e_try', 's_ok'], ['s_a', 'e_try', 's_bad']],
    );
    const ids = runChecks(m).filter((f) => f.ruleId === 'NONDETERMINISTIC').map((f) => f.id);
    expect(ids).toEqual(['f_nondeterministic_s_a_e_go', 'f_nondeterministic_s_a_e_try']);
  });

  it('reports TERMINAL_HAS_OUTGOING as low severity', () => {
    const m = build(
      [['s_a', { initial: true }], ['s_ok', { terminal: 'success' }], ['s_bad', { terminal: 'failure' }]],
      [['s_a', 'e_go', 's_ok'], ['s_a', 'e_fail', 's_bad'], ['s_ok', 'e_again', 's_a']],
    );
    const findings = runChecks(m);
    expect(findings.map((f) => [f.id, f.severity])).toEqual([['f_terminal_has_outgoing_s_ok', 'low']]);
    expect(findings[0]?.title).toBe('End state "ok" has moves leaving it');
  });

  describe('MISSING_HANDLER', () => {
    const ends: [string, { terminal: 'success' | 'failure' }][] = [['s_ok', { terminal: 'success' }], ['s_bad', { terminal: 'failure' }]];

    it('counts a duplicate self-loop as handled', () => {
      const m = build(
        [['s_a', { initial: true, userInput: true }], ...ends],
        [['s_a', 'e_go', 's_ok'], ['s_a', 'e_fail', 's_bad'], ['s_a', 'e_cancel', 's_bad'], ['s_a', 'e_duplicate', 's_a']],
      );
      expect(runChecks(m)).toEqual([]);
    });

    it('requires each kind once, with the higher severity, when a state has both flags', () => {
      const m = build(
        [['s_a', { initial: true, awaitsExternal: true, userInput: true }], ...ends],
        [['s_a', 'e_go', 's_ok'], ['s_a', 'e_no', 's_bad']],
      );
      expect(runChecks(m).map((f) => [f.requiredKind, f.severity])).toEqual([
        ['timeout', 'high'],
        ['failure', 'high'],
        ['cancel', 'medium'],
        ['duplicate', 'medium'],
      ]);
    });

    it('skips terminal and unreachable states', () => {
      const m = build(
        [
          ['s_a', { initial: true }],
          ['s_ok', { terminal: 'success', awaitsExternal: true, userInput: true }],
          ['s_bad', { terminal: 'failure' }],
          ['s_far', { awaitsExternal: true, userInput: true }],
        ],
        [['s_a', 'e_go', 's_ok'], ['s_a', 'e_no', 's_bad'], ['s_far', 'e_go', 's_ok']],
      );
      expect(rules(runChecks(m))).toEqual(['UNREACHABLE_STATE']);
    });
  });

  it('is deterministic', () => {
    const m = bnplMachine();
    expect(runChecks(m)).toEqual(runChecks(m));
    expect(JSON.stringify(runChecks(bnplMachine()))).toBe(JSON.stringify(runChecks(bnplMachine())));
  });

  it('does not change its input', () => {
    const m = bnplMachine();
    const copy = structuredClone(m);
    runChecks(m);
    expect(m).toEqual(copy);
  });
});
