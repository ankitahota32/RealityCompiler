import { AppError } from '../http';

// Token budget guard (SPEC §12.1): sliding 60 s window under TPM_SAFETY, one call in flight,
// at most 25 requests per minute. It must never crash a request.

const WINDOW_MS = 60_000;

export interface BudgetOptions {
  safety: number;
  maxRequestsPerMinute?: number;
  pollMs?: number;
  maxWaitMs?: number;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** §12.1 estimate: characters / 3.5, plus 1120 per image, plus the output cap. */
export function estimateTokens(systemInstruction: string, userText: string, imageCount: number, maxOutputTokens: number): number {
  return Math.ceil((systemInstruction.length + userText.length) / 3.5) + imageCount * 1120 + maxOutputTokens;
}

export class TokenBudget {
  private entries: { time: number; tokens: number }[] = [];
  private tail: Promise<void> = Promise.resolve();
  private readonly safety: number;
  private readonly maxRequests: number;
  private readonly pollMs: number;
  private readonly maxWaitMs: number;
  private readonly now: () => number;
  private readonly sleep: (ms: number) => Promise<void>;

  constructor(o: BudgetOptions) {
    this.safety = o.safety;
    this.maxRequests = o.maxRequestsPerMinute ?? 25;
    this.pollMs = o.pollMs ?? 500;
    this.maxWaitMs = o.maxWaitMs ?? 25_000;
    this.now = o.now ?? Date.now;
    this.sleep = o.sleep ?? defaultSleep;
  }

  /** Tokens recorded in the last 60 s. */
  used(): number {
    this.prune();
    return this.entries.reduce((sum, e) => sum + e.tokens, 0);
  }

  /**
   * Runs `fn` as the only call in flight, after reserving `estimate`. `fn` returns the real token count,
   * which replaces the estimate. Throws RATE_LIMITED if the budget does not free up within 25 s.
   */
  async run<T>(estimate: number, fn: () => Promise<{ value: T; totalTokens?: number }>): Promise<T> {
    const previous = this.tail;
    let release = () => {};
    this.tail = new Promise<void>((r) => {
      release = r;
    });
    await previous;
    try {
      let entry: { time: number; tokens: number } | undefined;
      try {
        entry = await this.reserve(estimate);
      } catch (e) {
        if (e instanceof AppError) throw e;
        console.warn('[budget] guard failed; continuing without it');
      }
      const { value, totalTokens } = await fn();
      if (entry !== undefined && totalTokens !== undefined) entry.tokens = totalTokens;
      return value;
    } finally {
      release();
    }
  }

  private prune() {
    const t = this.now();
    this.entries = this.entries.filter((e) => t - e.time < WINDOW_MS);
  }

  private fits(estimate: number): boolean {
    this.prune();
    if (this.entries.length >= this.maxRequests) return false;
    const used = this.entries.reduce((sum, e) => sum + e.tokens, 0);
    // A single call larger than the ceiling may run when nothing else is in the window.
    return used + estimate <= this.safety || used === 0;
  }

  /** Seconds until enough old entries expire for `estimate` to fit (at least 5). */
  private secondsUntilFree(estimate: number): number {
    const t = this.now();
    let used = this.entries.reduce((sum, e) => sum + e.tokens, 0);
    let count = this.entries.length;
    for (const e of [...this.entries].sort((a, b) => a.time - b.time)) {
      used -= e.tokens;
      count -= 1;
      if ((used + estimate <= this.safety || used === 0) && count < this.maxRequests) {
        return Math.max(5, Math.ceil((e.time + WINDOW_MS - t) / 1000));
      }
    }
    return 5;
  }

  private async reserve(estimate: number): Promise<{ time: number; tokens: number }> {
    const start = this.now();
    while (!this.fits(estimate)) {
      if (this.now() - start >= this.maxWaitMs) {
        throw new AppError('RATE_LIMITED', 'The token budget is used up for now.', this.secondsUntilFree(estimate));
      }
      await this.sleep(this.pollMs);
    }
    const entry = { time: this.now(), tokens: estimate };
    this.entries.push(entry);
    return entry;
  }
}

let shared: TokenBudget | undefined;

/** One budget per server process. */
export function getBudget(safety: number): TokenBudget {
  shared ??= new TokenBudget({ safety });
  return shared;
}
