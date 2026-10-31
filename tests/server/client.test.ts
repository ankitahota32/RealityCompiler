import { ApiError, GenerateContentResponse, type GenerateContentParameters } from '@google/genai';
import { describe, expect, it, vi } from 'vitest';
import { TokenBudget } from '@/server/gemma/budget';
import { createRealClient, parseTextJson, type GemmaCallOptions, type GenAiLike } from '@/server/gemma/client';

const decl = { name: 'submit_x', description: 'Submit x.', parameters: { type: 'object', properties: {} } };
const options = (over: Partial<GemmaCallOptions> = {}): GemmaCallOptions => ({
  step: 'extract', model: 'm', systemInstruction: 'SYS', userText: 'USER', functionDeclaration: decl,
  thinking: 'minimal', maxOutputTokens: 100, ...over,
});

/** `usage: null` means the response has no usage metadata. */
function response(parts: object[], usage: object | null = { promptTokenCount: 7, candidatesTokenCount: 3, totalTokenCount: 12 }) {
  return Object.assign(new GenerateContentResponse(), {
    candidates: [{ content: { role: 'model', parts }, finishReason: 'STOP' }],
    usageMetadata: usage ?? undefined,
  });
}
const callPart = (args: object) => ({ functionCall: { name: 'submit_x', args } });

function fakeAi(answers: (GenerateContentResponse | Error)[]) {
  const requests: GenerateContentParameters[] = [];
  const deleted: string[] = [];
  let uploads = 0;
  const ai: GenAiLike = {
    models: {
      async generateContent(params) {
        requests.push(params);
        const next = answers[requests.length - 1];
        if (next === undefined) throw new Error('no more answers');
        if (next instanceof Error) throw next;
        return next;
      },
    },
    files: {
      async upload(params) {
        uploads += 1;
        return { name: `files/${uploads}`, uri: `https://files/${uploads}`, mimeType: params.config?.mimeType };
      },
      async delete(params) {
        deleted.push(params.name);
        return {};
      },
    },
  };
  return { ai, requests, deleted };
}

const noSleep = vi.fn<(ms: number) => Promise<void>>(async () => {});
const client = (ai: GenAiLike) => createRealClient(ai, new TokenBudget({ safety: 1_000_000 }), { sleep: noSleep });
vi.spyOn(console, 'info').mockImplementation(() => {});
vi.spyOn(console, 'warn').mockImplementation(() => {});

describe('real Gemma client (fake SDK)', () => {
  it('returns the function call args and maps usage', async () => {
    const { ai, requests } = fakeAi([response([callPart({ ok: 1 })])]);
    const r = await client(ai).call(options());
    expect(r).toEqual({ args: { ok: 1 }, usage: { promptTokens: 7, outputTokens: 3, totalTokens: 12 } });
    const config = requests[0]?.config;
    expect(config?.systemInstruction).toBe('SYS');
    expect(config?.maxOutputTokens).toBe(100);
    expect(config?.thinkingConfig).toEqual({ thinkingLevel: 'MINIMAL' });
    expect(config?.tools).toEqual([{ functionDeclarations: [decl] }]);
    expect(config?.toolConfig).toBeUndefined();
  });

  it('uses HIGH thinking when asked', async () => {
    const { ai, requests } = fakeAi([response([callPart({})])]);
    await client(ai).call(options({ thinking: 'high' }));
    expect(requests[0]?.config?.thinkingConfig).toEqual({ thinkingLevel: 'HIGH' });
  });

  it('puts images before text and deletes the uploads afterwards', async () => {
    const { ai, requests, deleted } = fakeAi([response([callPart({})])]);
    const images = [
      { bytes: new Uint8Array([1]), mimeType: 'image/jpeg' as const },
      { bytes: new Uint8Array([2]), mimeType: 'image/png' as const },
    ];
    await client(ai).call(options({ images }));
    const contents = requests[0]?.contents as { parts: { fileData?: { fileUri: string; mimeType: string }; text?: string }[] };
    expect(contents.parts.map((p) => p.fileData?.fileUri ?? p.text)).toEqual(['https://files/1', 'https://files/2', 'USER']);
    expect(contents.parts[1]?.fileData?.mimeType).toBe('image/png');
    expect(deleted).toEqual(['files/1', 'files/2']);
  });

  it('deletes uploads even when the call fails', async () => {
    const { ai, deleted } = fakeAi([new ApiError({ message: 'bad request', status: 400 })]);
    await expect(client(ai).call(options({ images: [{ bytes: new Uint8Array([1]), mimeType: 'image/jpeg' }] })))
      .rejects.toMatchObject({ code: 'MODEL_ERROR' });
    expect(deleted).toEqual(['files/1']);
  });

  it('retries 503 and network errors twice, then succeeds', async () => {
    noSleep.mockClear();
    const { ai, requests } = fakeAi([
      new ApiError({ message: 'high demand', status: 503 }),
      new TypeError('fetch failed'),
      response([callPart({ ok: true })]),
    ]);
    await expect(client(ai).call(options())).resolves.toMatchObject({ args: { ok: true } });
    expect(requests).toHaveLength(3);
    expect(noSleep.mock.calls.map((c) => c[0])).toEqual([2000, 5000]);
  });

  it('gives MODEL_ERROR after three server errors and RATE_LIMITED for 429, using retryDelay', async () => {
    const e500 = () => new ApiError({ message: 'internal', status: 500 });
    await expect(client(fakeAi([e500(), e500(), e500()]).ai).call(options())).rejects.toMatchObject({ code: 'MODEL_ERROR' });

    noSleep.mockClear();
    const e429 = () => new ApiError({ message: '{"error":{"details":[{"retryDelay": "23s"}]}}', status: 429 });
    await expect(client(fakeAi([e429(), e429(), e429()]).ai).call(options()))
      .rejects.toMatchObject({ code: 'RATE_LIMITED', retryAfterSec: 23 });
    expect(noSleep.mock.calls.map((c) => c[0])).toEqual([23_000, 23_000]);
  });

  it('does not retry other client errors', async () => {
    const { ai, requests } = fakeAi([new ApiError({ message: 'bad', status: 400 })]);
    await expect(client(ai).call(options())).rejects.toMatchObject({ code: 'MODEL_ERROR' });
    expect(requests).toHaveLength(1);
  });

  it('asks once more when no function call comes back, then parses text JSON (ยง7.5)', async () => {
    const { ai, requests } = fakeAi([
      response([{ text: 'Sure! Here is the machine.' }]),
      response([{ text: '```json\n{"fromText": true}\n```' }]),
    ]);
    const r = await client(ai).call(options());
    expect(r.args).toEqual({ fromText: true });
    expect(r.usage.totalTokens).toBe(24);
    const second = requests[1]?.contents as { parts: { text?: string }[] };
    expect(second.parts.at(-1)?.text).toBe('USER\n\nYou must answer by calling submit_x. Do not answer in text.');
  });

  it('reserves budget before the ง7.5 retry and does not send it when there is no room', async () => {
    const { ai, requests } = fakeAi([
      response([{ text: 'no call' }], { promptTokenCount: 5, candidatesTokenCount: 5, totalTokenCount: 900 }),
      response([callPart({ ok: 1 })]),
    ]);
    const tight = createRealClient(ai, new TokenBudget({ safety: 1000, retryWaitMs: 0 }), { sleep: noSleep });
    await expect(tight.call(options())).rejects.toMatchObject({ code: 'RATE_LIMITED' });
    expect(requests).toHaveLength(1);
  });

  it('gives MODEL_OUTPUT_INVALID when neither a call nor JSON comes back', async () => {
    const { ai } = fakeAi([response([{ text: 'no' }]), response([{ text: 'still no' }])]);
    await expect(client(ai).call(options())).rejects.toMatchObject({ code: 'MODEL_OUTPUT_INVALID' });
  });

  it('treats a missing output count as 0 and estimates when usage is missing', async () => {
    const partial = fakeAi([response([callPart({})], { promptTokenCount: 5, totalTokenCount: 4005 })]);
    expect((await client(partial.ai).call(options())).usage).toEqual({ promptTokens: 5, outputTokens: 0, totalTokens: 4005 });

    const none = fakeAi([response([callPart({})], null)]);
    // estimate = ceil((3 + 4) / 3.5) + 0 images + 100 = 102
    expect((await client(none.ai).call(options())).usage).toEqual({ promptTokens: 2, outputTokens: 0, totalTokens: 102 });
  });
});

describe('parseTextJson', () => {
  it('parses plain and fenced JSON and rejects anything else', () => {
    expect(parseTextJson('{"a":1}')).toEqual({ a: 1 });
    expect(parseTextJson('```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(parseTextJson('```\n[1]\n```')).toEqual([1]);
    expect(parseTextJson('not json')).toBeUndefined();
    expect(parseTextJson(undefined)).toBeUndefined();
  });
});
