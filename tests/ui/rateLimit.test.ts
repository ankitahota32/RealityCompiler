import { describe, expect, it } from 'vitest';
import { retryDeadline, secondsLeft } from '@/components/rateLimit';

describe('rate-limit countdown', () => {
  it('counts down whole seconds, rounding up', () => {
    const end = retryDeadline(1_000, 30);
    expect(end).toBe(31_000);
    expect(secondsLeft(end, 1_000)).toBe(30);
    expect(secondsLeft(end, 1_001)).toBe(30);
    expect(secondsLeft(end, 2_000)).toBe(29);
    expect(secondsLeft(end, 30_999)).toBe(1);
  });

  it('ends exactly at the deadline and never goes negative', () => {
    const end = retryDeadline(0, 5);
    expect(secondsLeft(end, 5_000)).toBe(0);
    expect(secondsLeft(end, 60_000)).toBe(0);
  });

  it('treats a negative retryAfterSec as no wait', () => {
    expect(secondsLeft(retryDeadline(500, -3), 500)).toBe(0);
  });
});
