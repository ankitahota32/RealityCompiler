import { describe, expect, it, vi } from 'vitest';
import { runChecks } from '@/core/checker';
import { createApi, errorMessage } from '@/components/apiClient';
import { bnplMachine } from '../core/fixtures';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const fetchReturning = (res: Response | Error) => vi.fn<typeof fetch>(async () => {
  if (res instanceof Error) throw res;
  return res;
});
const usage = { promptTokens: 1, outputTokens: 2, totalTokens: 3 };

describe('errorMessage (SPEC §10.4 copy)', () => {
  it('maps every code to the exact text', () => {
    expect(errorMessage('VALIDATION', 'Flow name is required (1 to 80 characters).')).toBe('Flow name is required (1 to 80 characters).');
    expect(errorMessage('TOO_LARGE', 'x')).toBe('That file is too large. Try a smaller image.');
    expect(errorMessage('MODEL_OUTPUT_INVALID', 'x')).toBe('The AI gave an answer we could not use. Please try again.');
    expect(errorMessage('RATE_LIMITED', 'x', 42)).toBe('The free limit is reached for now. Try again in 42 seconds.');
    expect(errorMessage('MODEL_ERROR', 'x')).toBe('The AI service had a problem. Please try again.');
    expect(errorMessage('INTERNAL', 'Server is missing GEMINI_API_KEY.')).toBe('Something went wrong on our side.');
    expect(errorMessage('SOMETHING_NEW', 'x')).toBe('Something went wrong on our side.');
    expect(errorMessage('NETWORK', '')).toBe('Could not reach the server.');
  });
});

describe('createApi', () => {
  it('sends extract as multipart with every field and the images', async () => {
    const f = fetchReturning(json({ machine: bnplMachine(), usage, warnings: [] }));
    const r = await createApi(f).extract({ flowName: 'BNPL', flowType: 'payments', text: 'Some plan' }, [new Blob(['a'], { type: 'image/jpeg' })]);
    expect(r).toMatchObject({ ok: true, data: { usage } });
    const [url, init] = f.mock.calls[0]!;
    expect(url).toBe('/api/extract');
    const form = init?.body as FormData;
    expect([form.get('flowName'), form.get('flowType'), form.get('text'), form.getAll('images').length]).toEqual(['BNPL', 'payments', 'Some plan', 1]);
  });

  it('sends analyze and finalize as JSON', async () => {
    const machine = bnplMachine();
    const f = fetchReturning(json({ findings: runChecks(machine), matrix: [], usage, warnings: [] }));
    expect((await createApi(f).analyze(machine)).ok).toBe(true);
    expect(JSON.parse(String(f.mock.calls[0]![1]?.body))).toEqual({ machine });
  });

  it('turns error bodies into the exact copy, keeping retryAfterSec', async () => {
    const f = fetchReturning(json({ error: { code: 'RATE_LIMITED', message: 'slow', retryAfterSec: 30 } }, 429));
    expect(await createApi(f).demo()).toEqual({
      ok: false, code: 'RATE_LIMITED', message: 'The free limit is reached for now. Try again in 30 seconds.', retryAfterSec: 30,
    });
  });

  it('reports a network failure', async () => {
    expect(await createApi(fetchReturning(new TypeError('Failed to fetch'))).demo())
      .toEqual({ ok: false, code: 'NETWORK', message: 'Could not reach the server.' });
  });

  it('treats an unexpected response shape as INTERNAL', async () => {
    expect(await createApi(fetchReturning(json({ machine: 'nope' }))).demo())
      .toMatchObject({ ok: false, code: 'INTERNAL', message: 'Something went wrong on our side.' });
    expect(await createApi(fetchReturning(new Response('<html>', { status: 502 }))).demo())
      .toMatchObject({ ok: false, code: 'INTERNAL' });
  });
});
