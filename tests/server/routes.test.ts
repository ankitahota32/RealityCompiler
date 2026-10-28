import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runChecks } from '@/core/checker';
import { mergeFindings } from '@/core/merge';
import type { Finding, StateMachine } from '@/core/types';
import { POST as analyze } from '@/app/api/analyze/route';
import { GET as demo } from '@/app/api/demo/route';
import { POST as extract } from '@/app/api/extract/route';
import { POST as finalize } from '@/app/api/finalize/route';
import { GET as health } from '@/app/api/health/route';
import { bnplMachine } from '../core/fixtures';

// Routes are called directly with Request objects, in mock mode. Each request gets its own client key
// so the shared IP limiter never interferes.
let n = 0;
const headers = () => ({ 'x-forwarded-for': `10.0.0.${++n}` });
const jsonPost = (body: unknown) =>
  new Request('http://localhost/api', { method: 'POST', headers: { ...headers(), 'content-type': 'application/json' }, body: JSON.stringify(body) });
const formPost = (fields: Record<string, string | Blob | Blob[]>) => {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) {
    for (const item of Array.isArray(v) ? v : [v]) form.append(k, item);
  }
  return new Request('http://localhost/api/extract', { method: 'POST', headers: headers(), body: form });
};
const get = () => new Request('http://localhost/api', { headers: headers() });
const jpeg = (size = 10) => {
  const bytes = new Uint8Array(size);
  bytes.set([0xff, 0xd8, 0xff]);
  return new Blob([bytes], { type: 'image/jpeg' });
};
const BNPL_TEXT = 'Buy Now Pay Later checkout. The user opens the cart and taps Proceed.';

beforeEach(() => {
  vi.stubEnv('MOCK_GEMMA', '1');
  vi.stubEnv('GEMINI_API_KEY', '');
});
afterEach(() => {
  vi.unstubAllEnvs();
});

describe('/api/health', () => {
  it('works without a key and never includes it', async () => {
    vi.stubEnv('MOCK_GEMMA', '0');
    const res = await health(get());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      ok: true, mock: false,
      models: { extract: 'gemma-4-31b-it', analyze: 'gemma-4-26b-a4b-it', finalize: 'gemma-4-26b-a4b-it' },
    });
  });

  it('does not echo a configured key', async () => {
    vi.stubEnv('GEMINI_API_KEY', 'test-key-should-not-appear');
    expect(await (await health(get())).text()).not.toContain('test-key-should-not-appear');
  });
});

describe('missing key', () => {
  it('gives 500 INTERNAL with the SPEC message on AI routes when MOCK_GEMMA=0', async () => {
    vi.stubEnv('MOCK_GEMMA', '0');
    const res = await analyze(jsonPost({ machine: bnplMachine() }));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: { code: 'INTERNAL', message: 'Server is missing GEMINI_API_KEY.' } });
  });
});

describe('/api/extract', () => {
  it('returns a machine for valid text input (mock)', async () => {
    const res = await extract(formPost({ flowName: 'BNPL', text: BNPL_TEXT, flowType: 'payments' }));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { machine: StateMachine; usage: object; warnings: string[] };
    expect(body.machine.states).toHaveLength(7);
    expect(body.warnings).toEqual(['LOW_CONFIDENCE:1']);
    expect(body.usage).toEqual({ promptTokens: 0, outputTokens: 0, totalTokens: 0 });
  });

  it('accepts an image without text', async () => {
    expect((await extract(formPost({ flowName: 'BNPL', images: jpeg() }))).status).toBe(200);
  });

  const cases: [string, Record<string, string | Blob | Blob[]>, number, string][] = [
    ['missing flow name', { text: BNPL_TEXT }, 400, 'VALIDATION'],
    ['flow name over 80', { flowName: 'x'.repeat(81), text: BNPL_TEXT }, 400, 'VALIDATION'],
    ['text over 4000', { flowName: 'A', text: 'x'.repeat(4001) }, 413, 'TOO_LARGE'],
    ['short text and no image', { flowName: 'A', text: 'too short' }, 400, 'VALIDATION'],
    ['unknown flow type', { flowName: 'A', text: BNPL_TEXT, flowType: 'shopping' }, 400, 'VALIDATION'],
    ['four images', { flowName: 'A', images: [jpeg(), jpeg(), jpeg(), jpeg()] }, 400, 'VALIDATION'],
    ['image over 3 MB', { flowName: 'A', images: jpeg(3 * 1024 * 1024 + 1) }, 413, 'TOO_LARGE'],
    ['images over 4 MB together', { flowName: 'A', images: [jpeg(2 * 1024 * 1024), jpeg(2 * 1024 * 1024 + 1)] }, 413, 'TOO_LARGE'],
    ['not an image', { flowName: 'A', images: new Blob(['GIF89a'], { type: 'image/jpeg' }) }, 400, 'VALIDATION'],
  ];
  for (const [name, fields, status, code] of cases) {
    it(`rejects ${name}`, async () => {
      const res = await extract(formPost(fields));
      expect(res.status).toBe(status);
      expect(await res.json()).toMatchObject({ error: { code } });
    });
  }

  it('rejects a body that is not multipart', async () => {
    const res = await extract(jsonPost({ flowName: 'A' }));
    expect(res.status).toBe(400);
  });
});

describe('/api/analyze', () => {
  it('returns merged findings, matrix, zero usage (mock)', async () => {
    const res = await analyze(jsonPost({ machine: bnplMachine() }));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { findings: Finding[]; matrix: object[]; usage: object; warnings: string[] };
    expect(body.findings).toHaveLength(12);
    expect(body.matrix).toHaveLength(5);
    expect(body.warnings).toEqual([]);
  });

  it('rejects an invalid machine with the validateMachine errors', async () => {
    const machine = bnplMachine();
    machine.transitions[0]!.to = 's_missing';
    const res = await analyze(jsonPost({ machine }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: { code: 'VALIDATION', message: 'Transition t_proceed goes to unknown state s_missing' } });
  });

  it('rejects a body that is not JSON', async () => {
    const res = await analyze(new Request('http://localhost/api', { method: 'POST', headers: headers(), body: 'nope' }));
    expect(res.status).toBe(400);
  });
});

describe('/api/finalize', () => {
  it('returns the final result (mock)', async () => {
    const machine = bnplMachine();
    const findings = runChecks(machine);
    const res = await finalize(jsonPost({
      machine, findings,
      decisions: [{ findingId: 'f_missing_handler_s_credit_check_timeout', answerType: 'option', answer: 'Retry' }],
    }));
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(Object.keys(body).sort()).toEqual([
      'acceptedFindingIds', 'assumptions', 'machine', 'matrix', 'remainingFindings', 'resolvedFindingIds',
      'rules', 'scenarios', 'usage', 'warnings',
    ]);
    expect(body.remainingFindings).toHaveLength(7);
  });

  it('rejects a malformed body', async () => {
    const res = await finalize(jsonPost({ machine: bnplMachine(), findings: 'none', decisions: [] }));
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: { code: 'VALIDATION' } });
  });
});

describe('/api/demo', () => {
  it('returns the fixture machine and 3 AI findings; with the checker that makes 12', async () => {
    const res = await demo(get());
    expect(res.status).toBe(200);
    const body = (await res.json()) as { machine: StateMachine; aiFindings: Finding[] };
    expect(body.machine).toEqual(bnplMachine());
    expect(body.aiFindings.map((f) => [f.id, f.severity, f.stateIds])).toEqual([
      ['f_ai_1', 'high', ['s_credit_check']],
      ['f_ai_2', 'medium', ['s_confirm']],
      ['f_ai_3', 'low', ['s_checkout']],
    ]);
    expect(mergeFindings(runChecks(body.machine), body.aiFindings)).toHaveLength(12);
  });

  it('works with MOCK_GEMMA=0 and no key (no model call)', async () => {
    vi.stubEnv('MOCK_GEMMA', '0');
    expect((await demo(get())).status).toBe(200);
  });
});
