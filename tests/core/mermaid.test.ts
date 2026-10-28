import { describe, expect, it } from 'vitest';
import { sanitizeLabel, toMermaid } from '@/core/mermaid';
import { bnplMachine, build } from './fixtures';

describe('toMermaid', () => {
  it('renders the fixture exactly (SPEC §11.1)', () => {
    expect(toMermaid(bnplMachine())).toBe(
      [
        'stateDiagram-v2',
        '  direction LR',
        '  state "Cart" as s_cart',
        '  state "Checkout Review" as s_checkout',
        '  state "Credit Check" as s_credit_check',
        '  state "Confirm Plan" as s_confirm',
        '  state "Order Placed" as s_order_placed',
        '  state "Credit Declined" as s_credit_declined',
        '  state "Referral Bonus Screen" as s_referral',
        '  [*] --> s_cart',
        '  s_order_placed --> [*]',
        '  s_cart --> s_checkout : Tap Proceed',
        '  s_checkout --> s_credit_check : Submit Details',
        '  s_credit_check --> s_confirm : Credit Approved',
        '  s_credit_check --> s_credit_declined : Insufficient Credit',
        '  s_confirm --> s_order_placed : Confirm Plan',
        '  s_confirm --> s_cart : Cancel',
      ].join('\n'),
    );
  });

  it('writes no [*] start line unless exactly one state is initial, and an end line per terminal', () => {
    const m = build([['s_a', { initial: true }], ['s_b', { initial: true }], ['s_ok', { terminal: 'success' }], ['s_bad', { terminal: 'failure' }]], []);
    expect(toMermaid(m).split('\n').slice(6)).toEqual(['  s_ok --> [*]', '  s_bad --> [*]']);
  });
});

describe('sanitizeLabel', () => {
  it('replaces unsafe characters, collapses spaces, trims and cuts to 40', () => {
    expect(sanitizeLabel('Pay <script>"now"</script>!', 's_x')).toBe('Pay script now /script');
    expect(sanitizeLabel("Rider's (re)try, step 2/3 - ok_done.", 's_x')).toBe("Rider's (re)try, step 2/3 - ok_done.");
    expect(sanitizeLabel('  a\n\tb  ', 's_x')).toBe('a b');
    expect(sanitizeLabel('x'.repeat(50), 's_x')).toBe('x'.repeat(40));
    expect(sanitizeLabel('Café: €5 → ok', 's_x')).toBe('Caf 5 ok');
  });

  it('falls back to the id when nothing is left', () => {
    expect(sanitizeLabel('"<>"', 's_fallback')).toBe('s_fallback');
  });
});
