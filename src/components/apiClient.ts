import { z } from 'zod';
import {
  DecisionSchema,
  FindingSchema,
  ProjectResultSchema,
  StateMachineSchema,
  UsageSchema,
  type Decision,
  type Finding,
  type ProjectInput,
  type StateMachine,
} from '@/core/types';
import { COPY } from './copy';

// Browser calls to the API routes. Errors become the exact copy of SPEC §10.4.

export type ApiFailure = { ok: false; code: string; message: string; retryAfterSec?: number };
export type ApiResult<T> = { ok: true; data: T } | ApiFailure;

const ErrorBodySchema = z.object({
  error: z.object({ code: z.string(), message: z.string(), retryAfterSec: z.number().optional() }),
});

const ExtractResponseSchema = z.object({ machine: StateMachineSchema, usage: UsageSchema, warnings: z.array(z.string()) });
const AnalyzeResponseSchema = z.object({ findings: z.array(FindingSchema), usage: UsageSchema, warnings: z.array(z.string()) });
const FinalizeResponseSchema = ProjectResultSchema.extend({ usage: UsageSchema, warnings: z.array(z.string()) });
const DemoResponseSchema = z.object({ machine: StateMachineSchema, aiFindings: z.array(FindingSchema) });

export type ExtractResponse = z.infer<typeof ExtractResponseSchema>;
export type AnalyzeResponse = z.infer<typeof AnalyzeResponseSchema>;
export type FinalizeResponse = z.infer<typeof FinalizeResponseSchema>;
export type DemoResponse = z.infer<typeof DemoResponseSchema>;

/** SPEC §10.4 copy for an error code. VALIDATION shows the server message. */
export function errorMessage(code: string, serverMessage: string, retryAfterSec?: number): string {
  switch (code) {
    case 'VALIDATION':
      return serverMessage;
    case 'TOO_LARGE':
      return COPY.errors.TOO_LARGE;
    case 'MODEL_OUTPUT_INVALID':
      return COPY.errors.MODEL_OUTPUT_INVALID;
    case 'RATE_LIMITED':
      return COPY.errors.RATE_LIMITED(retryAfterSec ?? 60);
    case 'MODEL_ERROR':
      return COPY.errors.MODEL_ERROR;
    case 'NETWORK':
      return COPY.errors.NETWORK;
    default:
      return COPY.errors.INTERNAL;
  }
}

async function request<T>(url: string, init: RequestInit, schema: z.ZodType<T>, fetchImpl: typeof fetch): Promise<ApiResult<T>> {
  let res: Response;
  try {
    res = await fetchImpl(url, init);
  } catch {
    return { ok: false, code: 'NETWORK', message: COPY.errors.NETWORK };
  }
  let body: unknown;
  try {
    body = await res.json();
  } catch {
    body = undefined;
  }
  if (!res.ok) {
    const err = ErrorBodySchema.safeParse(body);
    if (!err.success) return { ok: false, code: 'INTERNAL', message: COPY.errors.INTERNAL };
    const { code, message, retryAfterSec } = err.data.error;
    return { ok: false, code, message: errorMessage(code, message, retryAfterSec), ...(retryAfterSec === undefined ? {} : { retryAfterSec }) };
  }
  const parsed = schema.safeParse(body);
  return parsed.success ? { ok: true, data: parsed.data } : { ok: false, code: 'INTERNAL', message: COPY.errors.INTERNAL };
}

const jsonInit = (body: unknown): RequestInit => ({
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
});

export function createApi(fetchImpl: typeof fetch = (...args) => fetch(...args)) {
  return {
    extract(input: ProjectInput, images: Blob[]) {
      const form = new FormData();
      form.append('flowName', input.flowName);
      form.append('flowType', input.flowType);
      form.append('text', input.text);
      images.forEach((blob, i) => form.append('images', blob, `image-${i + 1}.jpg`));
      return request('/api/extract', { method: 'POST', body: form }, ExtractResponseSchema, fetchImpl);
    },
    analyze(machine: StateMachine) {
      return request('/api/analyze', jsonInit({ machine }), AnalyzeResponseSchema, fetchImpl);
    },
    finalize(machine: StateMachine, findings: Finding[], decisions: Decision[]) {
      return request('/api/finalize', jsonInit({ machine, findings, decisions: z.array(DecisionSchema).parse(decisions) }), FinalizeResponseSchema, fetchImpl);
    },
    demo() {
      return request('/api/demo', { method: 'GET' }, DemoResponseSchema, fetchImpl);
    },
  };
}

export type Api = ReturnType<typeof createApi>;
