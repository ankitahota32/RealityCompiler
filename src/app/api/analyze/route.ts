import { StateMachineSchema } from '@/core/types';
import { validateMachine } from '@/core/validate';
import { getEnv } from '@/server/env';
import { getGemmaClient } from '@/server/gemma/client';
import { AppError, readJson, withApi } from '@/server/http';
import { runAnalyze } from '@/server/steps/analyze';

export const runtime = 'nodejs';
export const maxDuration = 60;

// POST /api/analyze (SPEC §9.2): { machine } → findings, matrix, usage, warnings.
export const POST = withApi(async (req) => {
  const env = getEnv();
  const client = getGemmaClient(env);
  const body = (await readJson(req)) as { machine?: unknown } | null;
  const check = validateMachine(body?.machine);
  if (!check.ok) throw new AppError('VALIDATION', check.errors.join('; '));
  const machine = StateMachineSchema.parse(body?.machine);
  return Response.json(await runAnalyze(machine, { client, model: env.models.analyze }));
});
