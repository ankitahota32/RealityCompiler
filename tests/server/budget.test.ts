import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TokenBudget, estimateTokens } from '@/server/gemma/budget';

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-29T10:00:00Z'));
});
afterEach(() => {
  vi.useRealTimers();
});

const done = (totalTokens?: number) => async () => ({ value: 'ok', totalTokens });

describe('TokenBudget', () => {
  it('lets a call through when it fits and records the real token count', async () => {
    const b = new TokenBudget({ safety: 14000 });
    await expect(b.run(5000, done(1200))).resolves.toBe('ok');
    expect(b.used()).toBe(1200);
  });

  it('waits for old entries to expire, then runs', async () => {
    const b = new TokenBudget({ safety: 14000 });
    await b.run(10000, done(10000));
    vi.advanceTimersByTime(50_000);
    let finished = false;
    const p = b.run(6000, done(6000)).then(() => {
      finished = true;
    });
    await vi.advanceTimersByTimeAsync(9_000);
    expect(finished).toBe(false);
    await vi.advanceTimersByTimeAsync(1_500);
    await p;
    expect(finished).toBe(true);
  });

  it('throws RATE_LIMITED after waiting 25 s, with seconds until enough frees (at least 5)', async () => {
    const b = new TokenBudget({ safety: 14000 });
    await b.run(13000, done(13000));
    const p = b.run(5000, done());
    const assertion = expect(p).rejects.toMatchObject({ code: 'RATE_LIMITED', retryAfterSec: 35 });
    await vi.advanceTimersByTimeAsync(25_500);
    await assertion;
  });

  it('runs one call at a time', async () => {
    const b = new TokenBudget({ safety: 100_000 });
    const order: string[] = [];
    const slow = b.run(1, async () => {
      order.push('slow start');
      await new Promise((r) => setTimeout(r, 1000));
      order.push('slow end');
      return { value: 1 };
    });
    const fast = b.run(1, async () => {
      order.push('fast');
      return { value: 2 };
    });
    await vi.advanceTimersByTimeAsync(1000);
    await Promise.all([slow, fast]);
    expect(order).toEqual(['slow start', 'slow end', 'fast']);
  });

  it('keeps going after a failed call', async () => {
    const b = new TokenBudget({ safety: 100_000 });
    await expect(b.run(1, async () => { throw new Error('boom'); })).rejects.toThrow('boom');
    await expect(b.run(1, done())).resolves.toBe('ok');
  });

  it('allows at most 25 requests per minute', async () => {
    const b = new TokenBudget({ safety: 1_000_000, maxWaitMs: 1000 });
    for (let i = 0; i < 25; i++) await b.run(1, done(1));
    const p = b.run(1, done(1));
    const assertion = expect(p).rejects.toMatchObject({ code: 'RATE_LIMITED' });
    await vi.advanceTimersByTimeAsync(1500);
    await assertion;
  });

  it('counts an attempt when it finishes and makes the retry wait for room (ง7.5)', async () => {
    const b = new TokenBudget({ safety: 14000 });
    let retrySent = false;
    const p = b.run(9000, async (run) => {
      await new Promise((r) => setTimeout(r, 120_000)); // a slow first attempt, like analyze
      run.record(7000);
      await run.reserveMore(9000);
      retrySent = true;
      run.record(8000);
      return { value: 'ok' };
    });
    await vi.advanceTimersByTimeAsync(120_000);
    expect(retrySent).toBe(false); // 7000 + 9000 would pass 14000 in the minute after the first attempt
    await vi.advanceTimersByTimeAsync(60_500);
    await expect(p).resolves.toBe('ok');
    expect(retrySent).toBe(true);
    expect(b.used()).toBe(8000);
  });

  it('gives RATE_LIMITED instead of sending a retry that cannot fit in time', async () => {
    const b = new TokenBudget({ safety: 14000, retryWaitMs: 10_000 });
    const p = b.run(9000, async (run) => {
      run.record(7000);
      await run.reserveMore(9000);
      return { value: 'sent' };
    });
    const assertion = expect(p).rejects.toMatchObject({ code: 'RATE_LIMITED', retryAfterSec: 50 });
    await vi.advanceTimersByTimeAsync(10_500);
    await assertion;
  });

  it('lets a single call above the ceiling run when the window is empty', async () => {
    const b = new TokenBudget({ safety: 1000 });
    await expect(b.run(5000, done())).resolves.toBe('ok');
  });
});

describe('estimateTokens', () => {
  it('follows SPEC ยง12.1', () => {
    expect(estimateTokens('a'.repeat(7), 'b'.repeat(7), 2, 3500)).toBe(4 + 2240 + 3500);
  });
});
