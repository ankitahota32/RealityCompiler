import { describe, expect, it } from 'vitest';
import { buildQuestion, type QuestionInput } from '@/core/questions';
import { HANDLER_KINDS, QuestionSchema } from '@/core/types';
import { bnplMachine, build } from './fixtures';

const m = bnplMachine();

const everyInput: QuestionInput[] = [
  { rule: 'NO_INITIAL' },
  { rule: 'MULTIPLE_INITIAL' },
  { rule: 'NO_SUCCESS_TERMINAL' },
  { rule: 'NO_FAILURE_TERMINAL' },
  { rule: 'UNREACHABLE_STATE', stateId: 's_referral' },
  { rule: 'DEAD_END_STATE', stateId: 's_credit_declined' },
  { rule: 'NO_PATH_TO_TERMINAL', stateId: 's_checkout' },
  { rule: 'TERMINAL_HAS_OUTGOING', stateId: 's_order_placed' },
  { rule: 'NONDETERMINISTIC', stateId: 's_credit_check', eventId: 'e_credit_ok', targetIds: ['s_confirm', 's_credit_declined'] },
  ...HANDLER_KINDS.map((kind): QuestionInput => ({ rule: 'MISSING_HANDLER', stateId: 's_credit_check', kind })),
];

describe('buildQuestion', () => {
  it('gives every rule and kind a valid question with 2 to 4 options of at most 80 characters', () => {
    for (const input of everyInput) {
      for (const machine of [m, build([], [])]) {
        const q = buildQuestion(input, machine);
        expect(QuestionSchema.safeParse(q).success, input.rule).toBe(true);
      }
    }
  });

  it('substitutes {state} and {initial}', () => {
    expect(buildQuestion({ rule: 'MISSING_HANDLER', stateId: 's_credit_check', kind: 'timeout' }, m)).toEqual({
      text: 'What should happen if "Credit Check" gets no answer in time?',
      options: [
        'Retry automatically, then show an error',
        'Show an error and let the user retry',
        'Cancel and go back to Cart',
        'Keep waiting and check again later',
      ],
    });
    expect(buildQuestion({ rule: 'DEAD_END_STATE', stateId: 's_credit_declined' }, m)).toEqual({
      text: 'After "Credit Declined", where should the user go next?',
      options: ['Back to Cart', 'Back to the previous step', 'Show a final failure screen (end of flow)'],
    });
  });

  it('uses "the start" for {initial} when there is not exactly one initial state', () => {
    const noStart = build([['s_a'], ['s_b']], []);
    expect(buildQuestion({ rule: 'NO_FAILURE_TERMINAL' }, noStart).options).toEqual([
      'Yes, add a final failure screen',
      'No, failures always return to the start',
    ]);
  });

  it('builds the dynamic option lists', () => {
    expect(buildQuestion({ rule: 'NO_INITIAL' }, m).options).toEqual([
      'Cart', 'Checkout Review', 'Credit Check', 'Another step (describe it)',
    ]);
    // Non-terminal states without outgoing transitions: Credit Declined, Referral Bonus Screen.
    expect(buildQuestion({ rule: 'NO_SUCCESS_TERMINAL' }, m).options).toEqual([
      'Credit Declined', 'Referral Bonus Screen', 'A new success end state is needed', 'Not sure yet',
    ]);
    const nd = buildQuestion(
      { rule: 'NONDETERMINISTIC', stateId: 's_cart', eventId: 'e_proceed', targetIds: ['s_checkout', 's_confirm', 's_referral', 's_cart'] },
      m,
    );
    expect(nd.text).toBe('When "Tap Proceed" happens in "Cart", which outcome is correct?');
    expect(nd.options).toEqual(['Checkout Review', 'Confirm Plan', 'Referral Bonus Screen', 'It depends on a condition (describe it)']);
    const two = build([['s_a', { initial: true }], ['s_b', { initial: true }]], []);
    expect(buildQuestion({ rule: 'MULTIPLE_INITIAL' }, two).options).toEqual(['a', 'b']);
  });

  it('pads to two options with "Not sure yet" when a machine has no states', () => {
    expect(buildQuestion({ rule: 'NO_INITIAL' }, build([], [])).options).toEqual(['Another step (describe it)', 'Not sure yet']);
  });

  it('cuts options to 80 characters', () => {
    const long = build([['s_a', { initial: true, label: 'x'.repeat(60) }]], []);
    const q = buildQuestion({ rule: 'MISSING_HANDLER', stateId: 's_a', kind: 'cancel' }, long);
    for (const o of q.options) expect(o.length).toBeLessThanOrEqual(80);
    expect(q.options[1]).toBe(`Yes, cancel everything and return to ${'x'.repeat(60)}`.slice(0, 80));
  });
});
