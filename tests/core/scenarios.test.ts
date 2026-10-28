import { describe, expect, it } from 'vitest';
import { generateTransitionScenarios, orderScenarios } from '@/core/scenarios';
import { ScenarioSchema } from '@/core/types';
import { bnplMachine, build } from './fixtures';

describe('generateTransitionScenarios', () => {
  it('creates one scenario per transition in machine order (fixture)', () => {
    const scenarios = generateTransitionScenarios(bnplMachine());
    expect(scenarios.map((s) => [s.id, s.title, s.priority])).toEqual([
      ['sc_t_t_proceed', 'Cart → Checkout Review on "Tap Proceed"', 'medium'],
      ['sc_t_t_submit', 'Checkout Review → Credit Check on "Submit Details"', 'medium'],
      ['sc_t_t_credit_ok', 'Credit Check → Confirm Plan on "Credit Approved"', 'medium'],
      ['sc_t_t_credit_low', 'Credit Check → Credit Declined on "Insufficient Credit"', 'medium'],
      ['sc_t_t_confirm', 'Confirm Plan → Order Placed on "Confirm Plan"', 'medium'],
      ['sc_t_t_cancel', 'Confirm Plan → Cart on "Cancel"', 'low'],
    ]);
    expect(scenarios[0]).toEqual({
      id: 'sc_t_t_proceed',
      origin: 'transition',
      title: 'Cart → Checkout Review on "Tap Proceed"',
      priority: 'medium',
      steps: [
        { keyword: 'Given', text: 'the flow is in "Cart"' },
        { keyword: 'When', text: 'the user does "Tap Proceed"' },
        { keyword: 'Then', text: 'the flow moves to "Checkout Review"' },
      ],
      coversTransitionIds: ['t_proceed'],
      coversFindingIds: [],
    });
    for (const s of scenarios) expect(ScenarioSchema.safeParse(s).success).toBe(true);
  });

  it('uses the When text and priority of each event kind, and "stays in" for self-loops', () => {
    const m = build(
      [['s_a', { initial: true }]],
      [['s_a', 'e_tap', 's_a'], ['s_a', 'e_system', 's_a'], ['s_a', 'e_timeout', 's_a'], ['s_a', 'e_failure', 's_a'], ['s_a', 'e_cancel', 's_a'], ['s_a', 'e_duplicate', 's_a']],
    );
    expect(generateTransitionScenarios(m).map((s) => [s.priority, s.steps[1]?.text, s.steps[2]?.text])).toEqual([
      ['medium', 'the user does "tap"', 'the flow stays in "a"'],
      ['medium', 'the system reports "system"', 'the flow stays in "a"'],
      ['high', 'the wait times out ("timeout")', 'the flow stays in "a"'],
      ['high', 'a failure occurs ("failure")', 'the flow stays in "a"'],
      ['low', 'the user cancels ("cancel")', 'the flow stays in "a"'],
      ['high', 'the user repeats the action ("duplicate")', 'the flow stays in "a"'],
    ]);
  });

  it('keeps titles within the 140-character schema limit', () => {
    const m = build([['s_a', { initial: true, label: 'a'.repeat(60) }], ['s_b', { label: 'b'.repeat(60) }]], [['s_a', 'e_go', 's_b']]);
    m.events[0]!.label = 'g'.repeat(60);
    const [s] = generateTransitionScenarios(m);
    expect(s?.title).toHaveLength(140);
    expect(ScenarioSchema.safeParse(s).success).toBe(true);
  });
});

describe('orderScenarios', () => {
  it('puts decision scenarios first, then transition scenarios in machine transition order', () => {
    const m = bnplMachine();
    const transition = generateTransitionScenarios(m);
    const decision = { ...transition[0]!, id: 'sc_ai_1', origin: 'decision' as const, coversTransitionIds: [] };
    const ordered = orderScenarios([...transition].reverse().concat(decision), m);
    expect(ordered.map((s) => s.id)).toEqual(['sc_ai_1', ...transition.map((s) => s.id)]);
  });
});
