import { describe, expect, it, vi } from 'vitest';
import { AppError, FixedWindowLimiter, clientKey, detectImageType, errorResponse, withApi } from '@/server/http';

describe('detectImageType', () => {
  it('recognises JPEG, PNG and WEBP by magic bytes only', () => {
    expect(detectImageType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe('image/jpeg');
    expect(detectImageType(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]))).toBe('image/png');
    expect(detectImageType(new Uint8Array([0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50]))).toBe('image/webp');
  });

  it('rejects everything else', () => {
    expect(detectImageType(new Uint8Array([0x47, 0x49, 0x46, 0x38]))).toBeNull(); // GIF
    expect(detectImageType(new Uint8Array([0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x41, 0x56, 0x45]))).toBeNull(); // WAV
    expect(detectImageType(new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"/>'))).toBeNull();
    expect(detectImageType(new Uint8Array([]))).toBeNull();
  });
});

describe('errorResponse', () => {
  it('uses the fixed shape and status for each code', async () => {
    const cases: [AppError, number][] = [
      [new AppError('VALIDATION', 'bad'), 400],
      [new AppError('TOO_LARGE', 'big'), 413],
      [new AppError('MODEL_OUTPUT_INVALID', 'x'), 422],
      [new AppError('MODEL_ERROR', 'x'), 502],
      [new AppError('INTERNAL', 'x'), 500],
    ];
    for (const [err, status] of cases) {
      const res = errorResponse(err);
      expect(res.status).toBe(status);
      expect(await res.json()).toEqual({ error: { code: err.code, message: err.message } });
    }
  });

  it('includes retryAfterSec and a Retry-After header for RATE_LIMITED', async () => {
    const res = errorResponse(new AppError('RATE_LIMITED', 'slow down', 12));
    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBe('12');
    expect(await res.json()).toEqual({ error: { code: 'RATE_LIMITED', message: 'slow down', retryAfterSec: 12 } });
  });

  it('hides unknown errors behind INTERNAL without the message or stack', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = errorResponse(new Error('secret detail at /home/x.ts:12'));
    expect(res.status).toBe(500);
    const text = await res.text();
    expect(text).not.toContain('secret');
    expect(JSON.parse(text)).toEqual({ error: { code: 'INTERNAL', message: 'Internal error.' } });
    expect(JSON.stringify(spy.mock.calls)).not.toContain('secret');
    spy.mockRestore();
  });
});

describe('IP limiter', () => {
  it('uses the first x-forwarded-for value, else "local"', () => {
    expect(clientKey(new Request('http://x', { headers: { 'x-forwarded-for': '1.2.3.4, 10.0.0.1' } }))).toBe('1.2.3.4');
    expect(clientKey(new Request('http://x'))).toBe('local');
  });

  it('allows 20 requests per minute per key', () => {
    let now = 0;
    const limiter = new FixedWindowLimiter(20, 60_000, () => now);
    for (let i = 0; i < 20; i++) expect(limiter.check('a').ok).toBe(true);
    expect(limiter.check('a')).toEqual({ ok: false, retryAfterSec: 60 });
    expect(limiter.check('b').ok).toBe(true);
    now = 45_000;
    expect(limiter.check('a')).toEqual({ ok: false, retryAfterSec: 15 });
    now = 60_000;
    expect(limiter.check('a').ok).toBe(true);
  });

  it('withApi returns 429 when the limit is hit, and can be switched off', async () => {
    const limiter = new FixedWindowLimiter(1, 60_000, () => 0);
    const limited = withApi(async () => Response.json({ ok: true }), { limiter });
    expect((await limited(new Request('http://x'))).status).toBe(200);
    const res = await limited(new Request('http://x'));
    expect(res.status).toBe(429);
    expect(await res.json()).toMatchObject({ error: { code: 'RATE_LIMITED', retryAfterSec: 60 } });

    const open = withApi(async () => Response.json({ ok: true }), { limiter, rateLimit: false });
    expect((await open(new Request('http://x'))).status).toBe(200);
  });
});
