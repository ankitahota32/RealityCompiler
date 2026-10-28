import { describe, expect, it } from 'vitest';
import { validateMachine } from '@/core/validate';
import { bnplMachine, tinyMachine } from './fixtures';

function errorsOf(m: unknown): string[] {
  const r = validateMachine(m);
  return r.ok ? [] : r.errors;
}

describe('validateMachine', () => {
  it('accepts the fixture', () => {
    expect(validateMachine(bnplMachine())).toEqual({ ok: true });
  });

  it('rejects a transition with unknown references and names the ids', () => {
    const m = tinyMachine();
    m.transitions.push({ id: 't_bad', from: 's_nope', event: 'e_nope', to: 's_gone', evidence: '', confidence: 1 });
    expect(errorsOf(m)).toEqual([
      'Transition t_bad starts at unknown state s_nope',
      'Transition t_bad uses unknown event e_nope',
      'Transition t_bad goes to unknown state s_gone',
    ]);
  });

  it('rejects duplicate ids', () => {
    const m = tinyMachine();
    m.states.push({ ...m.states[1]!, label: 'Again' });
    m.events.push({ ...m.events[0]! });
    m.transitions.push({ ...m.transitions[0]! });
    expect(errorsOf(m)).toEqual(['Duplicate state id s_b', 'Duplicate event id e_go', 'Duplicate transition id t_go']);
  });

  it('rejects a state that is both initial and terminal', () => {
    const m = tinyMachine();
    m.states[0]!.terminal = 'failure';
    expect(errorsOf(m)).toEqual(['State s_a cannot be both the start and an end state']);
  });

  it('allows zero or several initial states (the checker reports them)', () => {
    const none = tinyMachine();
    none.states[0]!.initial = false;
    expect(validateMachine(none).ok).toBe(true);
    const two = tinyMachine();
    two.states.push({ ...two.states[0]!, id: 's_c' });
    expect(validateMachine(two).ok).toBe(true);
  });

  it('enforces the caps of 25 states, 40 events and 60 transitions', () => {
    const m = tinyMachine();
    for (let i = 0; i < 24; i++) m.states.push({ ...m.states[1]!, id: `s_extra_${i}` });
    expect(errorsOf(m)).toEqual([expect.stringMatching(/^states: /)]);

    const e = tinyMachine();
    for (let i = 0; i < 40; i++) e.events.push({ ...e.events[0]!, id: `e_extra_${i}` });
    expect(errorsOf(e)).toEqual([expect.stringMatching(/^events: /)]);

    const t = tinyMachine();
    for (let i = 0; i < 60; i++) t.transitions.push({ ...t.transitions[0]!, id: `t_extra_${i}` });
    expect(errorsOf(t)).toEqual([expect.stringMatching(/^transitions: /)]);
  });

  it('rejects malformed ids and non-objects through zod', () => {
    const m = tinyMachine();
    m.states[0]!.id = 'Cart';
    expect(errorsOf(m)[0]).toMatch(/^states\.0\.id: /);
    expect(validateMachine(null).ok).toBe(false);
    expect(validateMachine('machine').ok).toBe(false);
  });
});
