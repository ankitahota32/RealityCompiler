import { describe, expect, it } from 'vitest';
import { runChecks } from '@/core/checker';
import { applyPatch } from '@/core/patch';
import { validateMachine } from '@/core/validate';
import type { Patch } from '@/core/types';
import { bnplMachine, bnplPatch, tinyMachine } from './fixtures';

const emptyPatch = (): Patch => ({ states: [], events: [], transitions: [] });

describe('applyPatch', () => {
  it('applies the Appendix D patch; exactly the 7 Appendix E.3 findings remain', () => {
    const { machine, warnings } = applyPatch(bnplMachine(), bnplPatch());
    expect(warnings).toEqual([]);
    expect(validateMachine(machine)).toEqual({ ok: true });
    expect(runChecks(machine).map((f) => f.id)).toEqual([
      'f_missing_handler_s_credit_check_failure',
      'f_no_failure_terminal_machine',
      'f_unreachable_state_s_referral',
      'f_missing_handler_s_checkout_cancel',
      'f_missing_handler_s_checkout_duplicate',
      'f_missing_handler_s_credit_check_cancel',
      'f_missing_handler_s_confirm_duplicate',
    ]);
  });

  it('drops items whose id already exists, with a warning', () => {
    const base = tinyMachine();
    const patch = emptyPatch();
    patch.states.push({ ...base.states[1]!, label: 'Other' });
    patch.events.push({ ...base.events[0]! });
    patch.transitions.push({ ...base.transitions[0]! });
    const { machine, warnings } = applyPatch(base, patch);
    expect(warnings).toEqual(['PATCH_DUPLICATE_ID:s_b', 'PATCH_DUPLICATE_ID:e_go', 'PATCH_DUPLICATE_ID:t_go']);
    expect(machine).toEqual(base);
  });

  it('drops transitions with unknown references but accepts references to items added in the same patch', () => {
    const base = tinyMachine();
    const patch = emptyPatch();
    patch.states.push({ ...base.states[0]!, id: 's_new' });
    patch.transitions.push(
      { id: 't_ok', from: 's_a', event: 'e_go', to: 's_new', evidence: '', confidence: 0.9 },
      { id: 't_bad', from: 's_a', event: 'e_missing', to: 's_b', evidence: '', confidence: 0.9 },
    );
    const { machine, warnings } = applyPatch(base, patch);
    expect(warnings).toEqual(['PATCH_BAD_REF:t_bad']);
    expect(machine.transitions.map((t) => t.id)).toEqual(['t_go', 't_ok']);
  });

  it('forces initial = false on added states', () => {
    const base = tinyMachine();
    const patch = emptyPatch();
    patch.states.push({ ...base.states[0]!, id: 's_new', initial: true });
    const { machine } = applyPatch(base, patch);
    expect(machine.states.find((s) => s.id === 's_new')?.initial).toBe(false);
  });

  it('respects the caps and warns once per kind', () => {
    const base = tinyMachine();
    const patch = emptyPatch();
    for (let i = 0; i < 30; i++) patch.states.push({ ...base.states[1]!, id: `s_p_${i}` });
    const { machine, warnings } = applyPatch(base, patch);
    expect(machine.states).toHaveLength(25);
    expect(warnings).toEqual(['PATCH_CAP:states']);
    expect(validateMachine(machine)).toEqual({ ok: true });
  });

  it('does not change its inputs', () => {
    const base = bnplMachine();
    const patch = bnplPatch();
    const before = structuredClone({ base, patch });
    applyPatch(base, patch);
    expect({ base, patch }).toEqual(before);
  });
});
