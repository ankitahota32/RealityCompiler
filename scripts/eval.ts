// Eval harness (SPEC §14.3). Run with `npm run eval`. Needs GEMINI_API_KEY in .env.local; never prints it.
// For each case in evals/cases: real extract → analyze (no finalize), then score the seeded gaps.

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { getEnv, requireApiKey } from '../src/server/env';
import { getGemmaClient, type Usage } from '../src/server/gemma/client';
import { AppError, detectImageType } from '../src/server/http';
import { runAnalyze } from '../src/server/steps/analyze';
import { runExtract } from '../src/server/steps/extract';
import { EvalCaseSchema, percent, scoreBaseline, scoreFindings, type EvalCase } from './evalScore';

const CASES = 'evals/cases';
const BASELINES = 'evals/baselines';

try {
  process.loadEnvFile('.env.local');
} catch {
  // No .env.local: the key check below explains what is missing.
}

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

const env = getEnv();
if (env.mock) fail('npm run eval measures the real model. Unset MOCK_GEMMA (or set it to 0) and try again.');
try {
  requireApiKey(env);
} catch {
  fail('GEMINI_API_KEY is missing. Add it to .env.local (see .env.example).');
}
const client = getGemmaClient(env);

function loadCases(): EvalCase[] {
  return readdirSync(CASES)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => {
      const parsed = EvalCaseSchema.safeParse(JSON.parse(readFileSync(path.join(CASES, f), 'utf8')));
      if (!parsed.success) fail(`${f} is not a valid case: ${parsed.error.issues.map((i) => i.path.join('.') + ' ' + i.message).join('; ')}`);
      return parsed.data;
    });
}

function loadImages(c: EvalCase) {
  return c.imagePaths.map((p) => {
    const bytes = new Uint8Array(readFileSync(p));
    const mimeType = detectImageType(bytes);
    if (!mimeType) fail(`${c.id}: ${p} is not a JPEG, PNG or WEBP image.`);
    return { bytes, mimeType };
  });
}

interface Row {
  id: string;
  seeded: number;
  found: number | string;
  recall: string;
  tokens: number | string;
  baseline: string;
  notes: string;
}

async function main() {
  const rows: Row[] = [];
  for (const c of loadCases()) {
    const baselineFile = path.join(BASELINES, `${c.id}.txt`);
    const baseline = existsSync(baselineFile) ? percent(scoreBaseline(c.seededGaps, readFileSync(baselineFile, 'utf8')).recall) : '–';
    const started = Date.now();
    try {
      const extracted = await runExtract(
        { flowName: c.name, flowType: c.flowType, text: c.text, images: loadImages(c) },
        { client, model: env.models.extract },
      );
      const analyzed = await runAnalyze(extracted.machine, { client, model: env.models.analyze });
      const usage: Usage[] = [extracted.usage, analyzed.usage];
      const s = scoreFindings(c.seededGaps, analyzed.findings);
      const sources = analyzed.findings.filter((f) => f.source === 'ai').length;
      rows.push({
        id: c.id,
        seeded: c.seededGaps.length,
        found: s.found.length,
        recall: percent(s.recall),
        tokens: usage.reduce((n, u) => n + u.totalTokens, 0),
        baseline,
        notes: [
          `extract ${extracted.usage.totalTokens}, analyze ${analyzed.usage.totalTokens} tokens`,
          `${analyzed.findings.length - sources} checker + ${sources} AI findings`,
          s.missed.length > 0 ? `missed ${s.missed.join(', ')}` : 'all found',
          ...analyzed.warnings,
          `${Math.round((Date.now() - started) / 1000)} s`,
        ].join('; '),
      });
    } catch (e) {
      const code = e instanceof AppError ? e.code : 'ERROR';
      rows.push({ id: c.id, seeded: c.seededGaps.length, found: '–', recall: '–', tokens: '–', baseline, notes: `failed: ${code}` });
    }
  }

  console.log(`\nModels: extract ${env.models.extract}, analyze ${env.models.analyze}\n`);
  console.log('| Case | Seeded | Found | Recall | Tokens | Baseline recall | Notes |');
  console.log('|---|---|---|---|---|---|---|');
  for (const r of rows) console.log(`| ${r.id} | ${r.seeded} | ${r.found} | ${r.recall} | ${r.tokens} | ${r.baseline} | ${r.notes} |`);
}

void main();
