import { randomUUID } from 'node:crypto';
import { rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  ApiError,
  GoogleGenAI,
  ThinkingLevel,
  createPartFromUri,
  createUserContent,
  type DeleteFileParameters,
  type File as GenAiFile,
  type GenerateContentParameters,
  type GenerateContentResponse,
  type Part,
  type Schema,
  type UploadFileParameters,
} from '@google/genai';
import { requireApiKey, type ServerEnv } from '../env';
import { AppError, type ImageMime } from '../http';
import { estimateTokens, getBudget, type TokenBudget } from './budget';
import { createMockClient } from './mock';

// Gemma client (SPEC §7.1). Steps depend only on the GemmaClient interface.

export interface GemmaCallOptions {
  step: 'extract' | 'analyze' | 'finalize';
  model: string;                       // from env, see §15
  systemInstruction: string;
  images?: { bytes: Uint8Array; mimeType: 'image/jpeg' | 'image/png' | 'image/webp' }[];
  userText: string;
  functionDeclaration: { name: string; description: string; parameters: object };
  thinking: 'high' | 'minimal';
  maxOutputTokens: number;
}
export interface GemmaCallResult {
  args: unknown;                       // the function call arguments, NOT yet validated
  usage: { promptTokens: number; outputTokens: number; totalTokens: number };
}
export interface GemmaClient { call(o: GemmaCallOptions): Promise<GemmaCallResult>; }

export type Usage = GemmaCallResult['usage'];
export const ZERO_USAGE: Usage = { promptTokens: 0, outputTokens: 0, totalTokens: 0 };
export const addUsage = (a: Usage, b: Usage): Usage => ({
  promptTokens: a.promptTokens + b.promptTokens,
  outputTokens: a.outputTokens + b.outputTokens,
  totalTokens: a.totalTokens + b.totalTokens,
});

/** Gemini failure after retries (SPEC §7.1 step 8): MODEL_ERROR or RATE_LIMITED. */
export class GemmaError extends AppError {}

/** The parts of the SDK the client uses, so tests can pass a fake. */
export interface GenAiLike {
  models: { generateContent(params: GenerateContentParameters): Promise<GenerateContentResponse> };
  files: {
    upload(params: UploadFileParameters): Promise<GenAiFile>;
    delete(params: DeleteFileParameters): Promise<unknown>;
  };
}

export interface RealClientOptions {
  sleep?: (ms: number) => Promise<void>;
  retryWaitsMs?: number[];
}

const EXTENSION: Record<ImageMime, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
const RETRYABLE = new Set([429, 500, 503]);

/** Seconds from a Gemini `retryDelay` such as "23s", if the error carries one. */
function retryDelaySec(message: string): number | undefined {
  const m = /"retryDelay":\s*"(\d+(?:\.\d+)?)s"/.exec(message);
  return m?.[1] === undefined ? undefined : Math.ceil(Number(m[1]));
}

/** §7.5: parse `response.text` as JSON, stripping a surrounding ```json fence. */
export function parseTextJson(text: string | undefined): unknown {
  if (!text) return undefined;
  const stripped = text.trim().replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/, '').trim();
  try {
    return JSON.parse(stripped);
  } catch {
    return undefined;
  }
}

export function createRealClient(ai: GenAiLike, budget: TokenBudget, options: RealClientOptions = {}): GemmaClient {
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const waits = options.retryWaitsMs ?? [2000, 5000];

  /** generateContent with retries for 429, 500, 503 and network errors. */
  async function generate(params: GenerateContentParameters): Promise<GenerateContentResponse> {
    for (let attempt = 0; ; attempt++) {
      try {
        return await ai.models.generateContent(params);
      } catch (e) {
        const status = e instanceof ApiError ? e.status : undefined;
        const message = e instanceof Error ? e.message : '';
        const delay = retryDelaySec(message);
        const wait = waits[attempt];
        if ((status === undefined || RETRYABLE.has(status)) && wait !== undefined) {
          await sleep(Math.max(wait, (delay ?? 0) * 1000));
          continue;
        }
        if (status === 429) throw new GemmaError('RATE_LIMITED', 'The AI service rate limit was reached.', delay ?? 30);
        throw new GemmaError('MODEL_ERROR', 'The AI service returned an error.');
      }
    }
  }

  return {
    async call(o) {
      const images = o.images ?? [];
      const estimate = estimateTokens(o.systemInstruction, o.userText, images.length, o.maxOutputTokens);
      return budget.run(estimate, async () => {
        const uploaded: string[] = [];
        try {
          // 1. Upload images through a random temp file each (SPEC §7.1 step 2).
          const imageParts: Part[] = [];
          for (const image of images) {
            const path = join(tmpdir(), `rc-${randomUUID()}.${EXTENSION[image.mimeType]}`);
            let file: GenAiFile;
            try {
              await writeFile(path, image.bytes);
              file = await ai.files.upload({ file: path, config: { mimeType: image.mimeType } });
            } catch {
              throw new GemmaError('MODEL_ERROR', 'Uploading an image to the AI service failed.');
            } finally {
              await rm(path, { force: true });
            }
            if (file.name) uploaded.push(file.name);
            if (!file.uri) throw new GemmaError('MODEL_ERROR', 'The AI service did not accept an image.');
            imageParts.push(createPartFromUri(file.uri, file.mimeType ?? image.mimeType));
          }

          const config: GenerateContentParameters['config'] = {
            systemInstruction: o.systemInstruction,
            tools: [{
              functionDeclarations: [{
                name: o.functionDeclaration.name,
                description: o.functionDeclaration.description,
                parameters: o.functionDeclaration.parameters as Schema,
              }],
            }],
            maxOutputTokens: o.maxOutputTokens,
            thinkingConfig: { thinkingLevel: o.thinking === 'high' ? ThinkingLevel.HIGH : ThinkingLevel.MINIMAL },
            // No forced toolConfig: the spike showed it makes results worse (docs/DECISIONS.md, M2).
          };
          const name = o.functionDeclaration.name;
          let usage = ZERO_USAGE;

          const once = async (userText: string) => {
            const start = Date.now();
            // Images first, text last (model card advice, SPEC §7.1 step 3).
            const response = await generate({ model: o.model, contents: createUserContent([...imageParts, userText]), config });
            const u = response.usageMetadata;
            let callUsage: Usage;
            if (typeof u?.totalTokenCount === 'number') {
              callUsage = {
                promptTokens: u.promptTokenCount ?? 0,
                outputTokens: u.candidatesTokenCount ?? 0,
                totalTokens: u.totalTokenCount,
              };
            } else {
              console.warn('[gemma] usage metadata missing; using the estimate');
              callUsage = { promptTokens: estimate - o.maxOutputTokens, outputTokens: 0, totalTokens: estimate };
            }
            usage = addUsage(usage, callUsage);
            console.info(JSON.stringify({ step: o.step, model: o.model, ...callUsage, ms: Date.now() - start }));
            return response;
          };

          const first = await once(o.userText);
          let args: unknown = first.functionCalls?.find((c) => c.name === name)?.args;
          if (args === undefined) {
            // §7.5: one more attempt with an explicit instruction, then text JSON.
            const second = await once(`${o.userText}\n\nYou must answer by calling ${name}. Do not answer in text.`);
            args = second.functionCalls?.find((c) => c.name === name)?.args ?? parseTextJson(second.text) ?? parseTextJson(first.text);
          }
          if (args === undefined) throw new AppError('MODEL_OUTPUT_INVALID', 'The model did not return a usable answer.');
          return { value: { args, usage }, totalTokens: usage.totalTokens };
        } finally {
          // Best effort (SPEC §7.1 step 7).
          await Promise.allSettled(uploaded.map((n) => ai.files.delete({ name: n })));
        }
      });
    },
  };
}

let realClient: { key: string; client: GemmaClient } | undefined;

/** The mock when MOCK_GEMMA=1, else the real client (500 INTERNAL if the key is missing). */
export function getGemmaClient(env: ServerEnv): GemmaClient {
  if (env.mock) return createMockClient();
  const key = requireApiKey(env);
  if (realClient?.key !== key) {
    realClient = { key, client: createRealClient(new GoogleGenAI({ apiKey: key }), getBudget(env.tpmSafety)) };
  }
  return realClient.client;
}
