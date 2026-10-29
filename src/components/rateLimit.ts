// Countdown for RATE_LIMITED (SPEC §10.4): show the seconds left and re-enable the buttons at zero.

/** When the wait ends, in ms since the epoch. */
export function retryDeadline(nowMs: number, retryAfterSec: number): number {
  return nowMs + Math.max(0, retryAfterSec) * 1000;
}

/** Whole seconds left before the deadline, rounded up, never below 0. */
export function secondsLeft(deadlineMs: number, nowMs: number): number {
  return Math.max(0, Math.ceil((deadlineMs - nowMs) / 1000));
}
