import { z } from 'zod';
import { AppError } from './http';

// Environment (SPEC §15). Read on each call so tests and restarts see current values.

const optional = (schema: z.ZodType) => z.preprocess((v) => (v === '' ? undefined : v), schema);

const EnvSchema = z.object({
  GEMINI_API_KEY: optional(z.string().optional()),
  GEMMA_MODEL_EXTRACT: optional(z.string().min(1).default('gemma-4-31b-it')),
  GEMMA_MODEL_ANALYZE: optional(z.string().min(1).default('gemma-4-26b-a4b-it')),
  GEMMA_MODEL_FINALIZE: optional(z.string().min(1).default('gemma-4-26b-a4b-it')),
  MOCK_GEMMA: optional(z.enum(['0', '1']).default('0')),
  TPM_LIMIT: optional(z.coerce.number().int().positive().default(16000)),
  TPM_SAFETY: optional(z.coerce.number().int().positive().default(14000)),
});

export interface ServerEnv {
  mock: boolean;
  apiKey: string | undefined;
  models: { extract: string; analyze: string; finalize: string };
  tpmLimit: number;
  tpmSafety: number;
}

export const MISSING_KEY_MESSAGE = 'Server is missing GEMINI_API_KEY.';

export function getEnv(source: Record<string, string | undefined> = process.env): ServerEnv {
  const parsed = EnvSchema.safeParse(source);
  if (!parsed.success) {
    // Name the variables, never their values.
    const names = [...new Set(parsed.error.issues.map((i) => String(i.path[0])))].join(', ');
    throw new AppError('INTERNAL', `Server configuration is invalid: ${names}.`);
  }
  const e = parsed.data as {
    GEMINI_API_KEY?: string; GEMMA_MODEL_EXTRACT: string; GEMMA_MODEL_ANALYZE: string; GEMMA_MODEL_FINALIZE: string;
    MOCK_GEMMA: '0' | '1'; TPM_LIMIT: number; TPM_SAFETY: number;
  };
  return {
    mock: e.MOCK_GEMMA === '1',
    apiKey: e.GEMINI_API_KEY,
    models: { extract: e.GEMMA_MODEL_EXTRACT, analyze: e.GEMMA_MODEL_ANALYZE, finalize: e.GEMMA_MODEL_FINALIZE },
    tpmLimit: e.TPM_LIMIT,
    tpmSafety: e.TPM_SAFETY,
  };
}

/** The key, or 500 INTERNAL with the exact SPEC §15 message. Not used by /api/health. */
export function requireApiKey(env: ServerEnv): string {
  if (!env.apiKey) throw new AppError('INTERNAL', MISSING_KEY_MESSAGE);
  return env.apiKey;
}
