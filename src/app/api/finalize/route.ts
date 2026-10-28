import { z } from 'zod';
import { DecisionSchema, FindingSchema, StateMachineSchema } from '@/core/types';
import { formatZodIssues, validateMachine } from '@/core/validate';
import { getEnv } from '@/server/env';
import { getGemmaClient } from '@/server/gemma/client';
import { AppError, readJson, withApi } from '@/server/http';
import { runFinalize } from '@/server/steps/finalize';

export const runtime = 'nodejs';
export const maxDuration = 60;

const BodySchema = z.object({
  machine: z.unknown(),
  findings: z.array(FindingSchema).max(100),
  decisions: z.array(DecisionSchema).max(100),
});

// POST /api/finalize (SPEC §9.3): { machine, findings, decisions } → final machine, rules, scenarios, issues.
export const POST = withApi(async (req) => {
  const env = getEnv();
  const client = getGemmaClient(env);
  const body = BodySchema.safeParse(await readJson(req));
  if (!body.success) throw new AppError('VALIDATION', formatZodIssues(body.error).join('; '));
  const check = validateMachine(body.data.machine);
  if (!check.ok) throw new AppError('VALIDATION', check.errors.join('; '));
  const machine = StateMachineSchema.parse(body.data.machine);
  const result = await runFinalize(
    { machine, findings: body.data.findings, decisions: body.data.decisions },
    { client, model: env.models.finalize },
  );
  return Response.json(result);
});
