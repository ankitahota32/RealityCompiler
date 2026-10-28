// M2 spike (SPEC §17): checks every [VERIFY] item against the real Gemini API and writes docs/SPIKE.md.
// Run with `npm run spike`. Reads GEMINI_API_KEY from .env.local; never prints it.
//
// Server-side errors (5xx, "high demand") say nothing about whether a feature works, so a check that only
// ever got server errors is NOT TESTED, never FAIL. Where a model is unavailable, the other model is tried.

import { readFileSync, writeFileSync } from 'node:fs';
import {
  ApiError,
  FunctionCallingConfigMode,
  GoogleGenAI,
  MediaResolution,
  PartMediaResolutionLevel,
  ThinkingLevel,
  createPartFromBase64,
  createPartFromUri,
  createUserContent,
  type FunctionDeclaration,
  type GenerateContentConfig,
  type GenerateContentResponse,
} from '@google/genai';
import machineJson from '../fixtures/bnpl.machine.json';
import { runChecks } from '../src/core/checker';
import { applyPatch } from '../src/core/patch';
import { PatchSchema, StateMachineSchema, type StateMachine } from '../src/core/types';
import { validateMachine } from '../src/core/validate';
import { submitFinalization, submitGapProposals, submitStateMachine } from '../src/server/gemma/declarations';
import {
  ANALYZE_SYSTEM_INSTRUCTION,
  EXTRACT_SYSTEM_INSTRUCTION,
  FINALIZE_SYSTEM_INSTRUCTION,
} from '../src/server/gemma/prompts';

const OUT = 'docs/SPIKE.md';
const SKETCH = 'fixtures/spike-sketch.jpg';
const TPM_SAFETY = 14000;

try {
  process.loadEnvFile('.env.local');
} catch {
  // No .env.local: fall through to the missing-key report.
}
const apiKey = process.env.GEMINI_API_KEY ?? '';
const MODEL_EXTRACT = process.env.GEMMA_MODEL_EXTRACT || 'gemma-4-31b-it';
const MODEL_ANALYZE = process.env.GEMMA_MODEL_ANALYZE || 'gemma-4-26b-a4b-it';
const MODEL_FINALIZE = process.env.GEMMA_MODEL_FINALIZE || 'gemma-4-26b-a4b-it';
const MODELS = [...new Set([MODEL_EXTRACT, MODEL_ANALYZE, MODEL_FINALIZE])];
/** The given model first, then the others (used when a model is down). */
const preferring = (model: string) => [model, ...MODELS.filter((m) => m !== model)];

// Appendix F sample text.
const BNPL_TEXT =
  "Buy Now Pay Later checkout. The user opens the cart and taps Proceed. On the Checkout Review screen the user enters details and taps Submit. The app then checks the user's credit with a bank. If credit is approved the user sees the Confirm Plan screen where they confirm and the order is placed. If credit is insufficient the user sees a Credit Declined screen. From Confirm Plan the user can cancel and go back to the cart.";

// SPEC §8 payments checklist, inlined for the realistic analyze timing. M3 moves it to src/packs.
const PAYMENTS_CHECKLIST = [
  'Payment result arrives late, after the user already cancelled or the order was marked failed: what happens to the order and the money?',
  'Money is deducted but the payment status is unknown or pending: how is it resolved, and when is the customer told?',
  'The user taps Pay twice or retries after an error: can they be charged twice?',
  'UPI or app-based payment: the user leaves to a payment app and never returns, or a collect request expires.',
  'The amount charged differs from the cart total (price change, coupon expired, tax or delivery fee changed).',
  'Refunds: full versus partial refund, a refund that fails or is delayed, and who is notified.',
  'Stock or price changes while the user is paying.',
  'Cash on delivery: order refused at the door or payment not collected.',
];

type Status = 'PASS' | 'FAIL' | 'NOT TESTED';
interface Row { id: string; check: string; status: Status; evidence: string; decision: string }
interface CallLog {
  label: string; model: string; ms: number; attempts: number;
  prompt?: number; output?: number; thoughts?: number; total?: number; finish?: string; error?: string;
}
interface ApiErr { message: string; status?: number }
interface CallResult { response?: GenerateContentResponse; error?: ApiErr; ms: number; model: string }

const rows: Row[] = [];
const calls: CallLog[] = [];
const notes: string[] = [];

/** Keeps the key out of anything written or printed. */
const redact = (s: string) => (apiKey ? s.split(apiKey).join('[redacted]') : s);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const short = (s: string, n = 160) => redact(s.replace(/\s+/g, ' ').trim()).slice(0, n);
const cellText = (s: string) => s.replace(/\|/g, '\\|').replace(/\n/g, ' ');
/** 5xx or network: the service failed, the feature was not exercised. */
const isServiceError = (e?: ApiErr) => e !== undefined && (e.status === undefined || e.status >= 500);
const errShort = (e?: ApiErr) => (e ? `${e.status ?? 'network'} ${short(e.message.replace(/^\{"error":\{"code":\d+,"message":"/, ''), 70)}` : 'no response');

// ---- Token budget: sliding 60 s window under TPM_SAFETY (same idea as SPEC §12.1). ----
const budgetWindow: { time: number; tokens: number }[] = [];
async function reserve(estimate: number): Promise<{ time: number; tokens: number }> {
  for (;;) {
    const now = Date.now();
    while (budgetWindow.length > 0 && now - (budgetWindow[0]?.time ?? now) > 60_000) budgetWindow.shift();
    const used = budgetWindow.reduce((sum, e) => sum + e.tokens, 0);
    if (used + estimate <= TPM_SAFETY) {
      const entry = { time: now, tokens: estimate };
      budgetWindow.push(entry);
      return entry;
    }
    process.stdout.write(`  (budget: ${used} + ${estimate} > ${TPM_SAFETY}, waiting)\n`);
    await sleep(3000);
  }
}
const estimateTokens = (system: string, user: string, images: number, maxOut: number) =>
  Math.ceil((system.length + user.length) / 3.5) + images * 1120 + maxOut;

function errorText(e: unknown): ApiErr {
  if (e instanceof ApiError) return { message: short(e.message, 300), status: e.status };
  if (e instanceof Error) return { message: short(e.message, 300) };
  return { message: short(String(e), 300) };
}

const ai = new GoogleGenAI({ apiKey });
type Contents = Parameters<typeof ai.models.generateContent>[0]['contents'];

/** One generateContent call with budget, retries (429 and 5xx: 3 s, 10 s, 30 s; at least 20 s for 429) and logging. */
async function generate(label: string, model: string, contents: Contents, config: GenerateContentConfig, estimate: number): Promise<CallResult> {
  const entry = await reserve(estimate);
  const waits = [3000, 10_000, 30_000];
  const first = Date.now();
  for (let attempt = 0; ; attempt++) {
    try {
      const start = Date.now();
      const response = await ai.models.generateContent({ model, contents, config });
      const ms = Date.now() - start;
      const u = response.usageMetadata;
      const finish = response.candidates?.[0]?.finishReason;
      if (typeof u?.totalTokenCount === 'number') entry.tokens = u.totalTokenCount;
      calls.push({ label, model, ms, attempts: attempt + 1, prompt: u?.promptTokenCount, output: u?.candidatesTokenCount, thoughts: u?.thoughtsTokenCount, total: u?.totalTokenCount, finish });
      console.info(`  ${label} [${model}] ${ms} ms, tokens ${u?.promptTokenCount ?? '?'} + ${u?.candidatesTokenCount ?? '?'} (thoughts ${u?.thoughtsTokenCount ?? 0}) = ${u?.totalTokenCount ?? '?'}, finish ${finish ?? '?'}`);
      return { response, ms, model };
    } catch (e) {
      const err = errorText(e);
      const wait = waits[attempt];
      if ((err.status === 429 || isServiceError(err)) && wait !== undefined) {
        console.info(`  ${label} [${model}] ${errShort(err)}, retry in ${err.status === 429 ? Math.max(wait, 20_000) / 1000 : wait / 1000} s`);
        await sleep(err.status === 429 ? Math.max(wait, 20_000) : wait);
        continue;
      }
      entry.tokens = 0;
      calls.push({ label, model, ms: Date.now() - first, attempts: attempt + 1, error: errShort(err) });
      console.info(`  ${label} [${model}] GAVE UP: ${errShort(err)}`);
      return { error: err, ms: Date.now() - first, model };
    }
  }
}

/** Tries each model in turn while the service keeps failing; returns the first real outcome (or the last failure). */
async function onAvailableModel(models: string[], run: (model: string) => Promise<CallResult>): Promise<CallResult> {
  let last: CallResult | undefined;
  for (const model of models) {
    last = await run(model);
    if (!isServiceError(last.error)) return last;
  }
  return last ?? { ms: 0, model: models[0] ?? '' };
}

function add(id: string, check: string, status: Status, evidence: string, decision: string) {
  rows.push({ id, check, status, evidence: redact(evidence), decision });
  console.info(`${id} ${status}: ${evidence.slice(0, 160)}`);
}

const compactMachine = (m: StateMachine) =>
  JSON.stringify({
    states: m.states.map(({ id, label, initial, terminal, awaitsExternal, userInput }) => ({ id, label, initial, terminal, awaitsExternal, userInput })),
    events: m.events.map(({ id, label, kind }) => ({ id, label, kind })),
    transitions: m.transitions.map(({ id, from, event, to }) => ({ id, from, event, to })),
  });

/** Declaration in the shape the SPEC gives (`parameters`) or as raw JSON schema (`parametersJsonSchema`). */
function asTool(decl: { name: string; description: string; parameters: object }, mode: 'parameters' | 'parametersJsonSchema'): FunctionDeclaration {
  return mode === 'parameters'
    ? { name: decl.name, description: decl.description, parameters: decl.parameters as FunctionDeclaration['parameters'] }
    : { name: decl.name, description: decl.description, parametersJsonSchema: decl.parameters };
}
const forceCall = (name: string): GenerateContentConfig => ({
  toolConfig: { functionCallingConfig: { mode: FunctionCallingConfigMode.ANY, allowedFunctionNames: [name] } },
});
const callArgs = (r: CallResult, name: string) => r.response?.functionCalls?.find((c) => c.name === name)?.args;
const finishOf = (r: CallResult) => r.response?.candidates?.[0]?.finishReason ?? '?';

function writeReport(sdkVersion: string) {
  const lines = [
    '# Spike results',
    '',
    `Written by \`npm run spike\` (SPEC §17). Run at ${new Date().toISOString()}.`,
    '',
    `Models: extract \`${MODEL_EXTRACT}\`, analyze \`${MODEL_ANALYZE}\`, finalize \`${MODEL_FINALIZE}\`. SDK \`@google/genai\` ${sdkVersion}. Node ${process.version}.`,
    '',
    'A check that only got server errors (5xx, "high demand") is NOT TESTED, not FAIL: the feature was never exercised.',
    '',
    '| # | Check | Result | Evidence | Decision |',
    '|---|---|---|---|---|',
    ...rows.map((r) => `| ${r.id} | ${cellText(r.check)} | ${r.status} | ${cellText(r.evidence)} | ${cellText(r.decision)} |`),
    '',
    '## Calls',
    '',
    'Times are for the successful attempt; a call that gave up shows the total time of all attempts.',
    '',
    '| Call | Model | ms | Attempts | Prompt | Output | Thoughts | Total | Finish | Error |',
    '|---|---|---|---|---|---|---|---|---|---|',
    ...calls.map((c) => `| ${cellText(c.label)} | ${c.model} | ${c.ms} | ${c.attempts} | ${c.prompt ?? ''} | ${c.output ?? ''} | ${c.thoughts ?? ''} | ${c.total ?? ''} | ${c.finish ?? ''} | ${cellText(c.error ?? '')} |`),
    '',
    '## Notes',
    '',
    ...(notes.length > 0 ? notes.map((n) => `- ${redact(n)}`) : ['None.']),
    '',
  ];
  writeFileSync(OUT, lines.join('\n'));
  console.info(`\nWrote ${OUT}`);
}

async function main() {
  const sdkVersion = (JSON.parse(readFileSync('node_modules/@google/genai/package.json', 'utf8')) as { version: string }).version;

  if (!apiKey || apiKey.startsWith('your_')) {
    for (let i = 1; i <= 10; i++) add(`V${i}`, 'See SPEC §17', 'NOT TESTED', 'GEMINI_API_KEY missing', 'NOT TESTED – key missing');
    writeReport(sdkVersion);
    return;
  }

  // ---- V1 + V6: plain text on every model; record raw usage. ----
  console.info('\nV1/V6 plain text');
  const v1: string[] = [];
  const v1status: Status[] = [];
  let usageRaw = '';
  for (const model of MODELS) {
    const r = await generate('V1 plain text', model, 'Reply with exactly the word OK.', { maxOutputTokens: 512 }, 600);
    const text = r.response?.text?.trim() ?? '';
    if (r.response && text) {
      v1status.push('PASS');
      v1.push(`${model}: "${short(text, 20)}" in ${r.ms} ms`);
      if (!usageRaw && r.response.usageMetadata) usageRaw = JSON.stringify(r.response.usageMetadata);
    } else {
      v1status.push(isServiceError(r.error) ? 'NOT TESTED' : 'FAIL');
      v1.push(`${model}: ${r.error ? errShort(r.error) : 'empty text'}`);
    }
  }
  const v1final: Status = v1status.includes('FAIL') ? 'FAIL' : v1status.every((s) => s === 'PASS') ? 'PASS' : 'NOT TESTED';
  add('V1', 'Both model ids answer a plain text prompt', v1final, v1.join('; '),
    v1final === 'PASS' ? 'Use the configured model ids.' : v1final === 'FAIL' ? 'Check the current model list in AI Studio and update env defaults.' : 'Service errors only; re-run.');
  if (usageRaw) notes.push(`Raw usage metadata (V1): \`${usageRaw}\``);
  const usage = usageRaw ? (JSON.parse(usageRaw) as Record<string, unknown>) : {};
  const v6ok = ['promptTokenCount', 'candidatesTokenCount', 'totalTokenCount'].every((k) => typeof usage[k] === 'number');
  add('V6', 'Usage metadata field names', v6ok ? 'PASS' : usageRaw ? 'FAIL' : 'NOT TESTED',
    usageRaw ? `Fields: ${Object.keys(usage).join(', ')}` : 'No response',
    v6ok ? 'Read promptTokenCount, candidatesTokenCount, totalTokenCount. totalTokenCount includes thoughtsTokenCount; candidatesTokenCount can be missing when the model returns nothing, so treat missing as 0.' : 'Estimate tokens per §12.1 and log a warning.');

  // ---- V4: thinking levels on every model. ----
  console.info('\nV4 thinking levels');
  const v4: string[] = [];
  const v4fail: string[] = [];
  const v4untested: string[] = [];
  for (const model of MODELS) {
    for (const level of [ThinkingLevel.HIGH, ThinkingLevel.MINIMAL]) {
      const r = await generate(`V4 thinking ${level}`, model, 'What is 17 multiplied by 23? Reply with the number only.',
        { maxOutputTokens: 2048, thinkingConfig: { thinkingLevel: level } }, 2200);
      const text = r.response?.text?.trim() ?? '';
      if (r.response && text) v4.push(`${model} ${level}: "${short(text, 8)}", thoughts ${r.response.usageMetadata?.thoughtsTokenCount ?? 0}`);
      else {
        (isServiceError(r.error) ? v4untested : v4fail).push(`${model} ${level}`);
        v4.push(`${model} ${level}: ${r.error ? errShort(r.error) : 'empty text'}`);
      }
    }
  }
  const v4status: Status = v4fail.length > 0 ? 'FAIL' : v4untested.length > 0 ? 'NOT TESTED' : 'PASS';
  add('V4', 'Thinking levels HIGH and MINIMAL accepted by both models', v4status, v4.join('; '),
    v4status === 'PASS' ? 'Use thinkingConfig.thinkingLevel as SPEC §7.2 says.'
      : v4status === 'FAIL' ? `Drop thinkingConfig for: ${v4fail.join(', ')}.`
      : `Accepted where the service answered; not exercised for ${v4untested.join(', ')} (service errors). Keep thinkingConfig; re-run.`);

  // ---- V2, V9, V7, V8: image input. ----
  console.info('\nV2/V7/V8/V9 image');
  const bytes = readFileSync(SKETCH);
  const base64 = bytes.toString('base64');
  const readPrompt = 'Transcribe every word of handwritten text in this image. Reply with the text only.';
  const readsSketch = (t: string) => ['order', 'placed', 'payment'].every((w) => t.toLowerCase().includes(w));
  const imageConfig: GenerateContentConfig = { maxOutputTokens: 512, thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL } };

  // Files API path, as SPEC §7.1.
  let uploadedName: string | undefined;
  let uploadOk = false;
  let filesResult: CallResult | undefined;
  try {
    const file = await ai.files.upload({ file: SKETCH, config: { mimeType: 'image/jpeg' } });
    uploadedName = file.name;
    uploadOk = Boolean(file.uri && file.mimeType);
    let state = file.state;
    for (let i = 0; i < 10 && state === 'PROCESSING' && file.name; i++) {
      await sleep(1000);
      state = (await ai.files.get({ name: file.name })).state;
    }
    notes.push(`Files API upload: state ${state ?? '?'}, mimeType ${file.mimeType ?? '?'}.`);
    if (file.uri && file.mimeType) {
      const uri = file.uri;
      const mime = file.mimeType;
      filesResult = await onAvailableModel(preferring(MODEL_EXTRACT), (model) =>
        generate('V2 image via Files API', model, createUserContent([createPartFromUri(uri, mime), readPrompt]), imageConfig, 2000));
    }
  } catch (e) {
    notes.push(`Files API upload failed: ${errorText(e).message}`);
  }
  const filesText = filesResult?.response?.text ?? '';
  const filesStatus: Status = !uploadOk ? 'FAIL' : filesResult?.response ? (readsSketch(filesText) ? 'PASS' : 'FAIL') : isServiceError(filesResult?.error) ? 'NOT TESTED' : 'FAIL';
  const filesEvidence = !uploadOk ? 'Files API upload failed'
    : filesResult?.response ? `Files API on ${filesResult.model}: read "${short(filesText, 70)}", prompt tokens ${filesResult.response.usageMetadata?.promptTokenCount ?? '?'}`
    : `Files API: upload ok, generate ${errShort(filesResult?.error)} on every model`;

  // Inline path, the §17 fallback.
  const inline = await onAvailableModel(preferring(MODEL_EXTRACT), (model) =>
    generate('V2 image inline base64', model, createUserContent([createPartFromBase64(base64, 'image/jpeg'), readPrompt]), imageConfig, 2000));
  const inlineText = inline.response?.text ?? '';
  const inlineStatus: Status = inline.response ? (readsSketch(inlineText) ? 'PASS' : 'FAIL') : isServiceError(inline.error) ? 'NOT TESTED' : 'FAIL';
  const inlinePrompt = inline.response?.usageMetadata?.promptTokenCount;
  const inlineEvidence = inline.response
    ? `Inline on ${inline.model}: read "${short(inlineText, 70)}", prompt tokens ${inlinePrompt ?? '?'}`
    : `Inline: ${errShort(inline.error)}`;

  const v2status: Status = filesStatus === 'PASS' || inlineStatus === 'PASS' ? 'PASS' : filesStatus === 'FAIL' && inlineStatus === 'FAIL' ? 'FAIL' : 'NOT TESTED';
  add('V2', 'Image input works and the model reads text in the sketch', v2status,
    `${filesEvidence}. ${inlineEvidence}. Pass = the reading contains "order", "placed" and "payment".`,
    filesStatus === 'PASS' ? 'Keep the Files API path of SPEC §7.1.'
      : inlineStatus === 'PASS' && filesStatus === 'FAIL' ? 'Use inline data (createPartFromBase64); update the client.'
      : inlineStatus === 'PASS' ? 'Inline works; Files API not exercised (service errors). Re-run before choosing.'
      : 'Images unsupported or untested: tell the owner.');
  add('V9', 'Files API available on the free tier', filesStatus, filesEvidence,
    filesStatus === 'PASS' ? 'Files API usable.' : filesStatus === 'FAIL' ? (inlineStatus === 'PASS' ? 'Use inline data.' : 'Images unsupported: tell the owner.') : 'Service errors only; re-run.');

  // V7: visual token budget, per request and per part.
  const v7: string[] = [];
  let v7status: Status = 'NOT TESTED';
  const lowVariants: [string, () => Contents, GenerateContentConfig][] = [
    ['config.mediaResolution LOW', () => createUserContent([createPartFromBase64(base64, 'image/jpeg'), readPrompt]), { ...imageConfig, mediaResolution: MediaResolution.MEDIA_RESOLUTION_LOW }],
    ['part mediaResolution LOW', () => createUserContent([createPartFromBase64(base64, 'image/jpeg', PartMediaResolutionLevel.MEDIA_RESOLUTION_LOW), readPrompt]), imageConfig],
  ];
  for (const [name, contents, config] of lowVariants) {
    const r = await onAvailableModel(preferring(inline.model || MODEL_EXTRACT), (model) => generate(`V7 ${name}`, model, contents(), config, 1500));
    if (r.response) {
      const p = r.response.usageMetadata?.promptTokenCount;
      const lower = p !== undefined && inlinePrompt !== undefined && p < inlinePrompt;
      if (lower) v7status = 'PASS';
      else if (v7status !== 'PASS') v7status = 'FAIL';
      v7.push(`${name} on ${r.model}: prompt tokens ${p ?? '?'} vs default ${inlinePrompt ?? '?'}, reading ${readsSketch(r.response.text ?? '') ? 'still correct' : `wrong ("${short(r.response.text ?? '', 40)}")`}`);
    } else v7.push(`${name}: ${errShort(r.error)}`);
  }
  add('V7', 'Visual token budget can be set', v7status, v7.join('; '),
    v7status === 'PASS' ? 'Option exists. Keep the default for handwriting; the eval (M6) can test LOW.' : v7status === 'FAIL' ? 'Skip; use the default resolution.' : 'Service errors only; re-run.');

  // V8: delete the uploaded file, then confirm it is gone.
  if (uploadedName) {
    try {
      await ai.files.delete({ name: uploadedName });
      let gone = 'unknown';
      try {
        await ai.files.get({ name: uploadedName });
        gone = 'still listed afterwards';
      } catch (e) {
        gone = `files.get afterwards fails with ${errorText(e).status ?? 'error'}`;
      }
      add('V8', 'Uploaded file deletion works', 'PASS', `files.delete ok; ${gone}`, 'Delete uploaded files in finally (SPEC §7.1 step 7).');
    } catch (e) {
      add('V8', 'Uploaded file deletion works', 'FAIL', `files.delete: ${errorText(e).message}`, 'Skip deletion; files auto-expire; mention in README.');
    }
  } else {
    add('V8', 'Uploaded file deletion works', 'NOT TESTED', 'No uploaded file', 'Skip deletion; mention in README.');
  }
  try {
    const blobFile = await ai.files.upload({ file: new Blob([bytes], { type: 'image/jpeg' }), config: { mimeType: 'image/jpeg' } });
    if (blobFile.name) await ai.files.delete({ name: blobFile.name });
    notes.push('files.upload also accepts a Blob in this SDK version, so the server can upload without writing a temp file (SPEC §7.1 step 2 writes one).');
  } catch (e) {
    notes.push(`files.upload with a Blob failed: ${errorText(e).message}`);
  }

  // ---- V3: function calling with submit_state_machine on the Appendix F text (also the extract timing for V10). ----
  console.info('\nV3 function calling (extract)');
  const extractUser = `FLOW NAME: BNPL checkout\nFLOW TYPE HINT: payments\nUSER TEXT:\n${BNPL_TEXT}`;
  const extractEstimate = estimateTokens(EXTRACT_SYSTEM_INSTRUCTION, extractUser, 0, 3500);
  const extractConfig = (mode: 'parameters' | 'parametersJsonSchema'): GenerateContentConfig => ({
    systemInstruction: EXTRACT_SYSTEM_INSTRUCTION,
    tools: [{ functionDeclarations: [asTool(submitStateMachine, mode)] }],
    maxOutputTokens: 3500,
    thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
  });
  let declMode: 'parameters' | 'parametersJsonSchema' = 'parameters';
  let v3status: Status = 'NOT TESTED';
  const v3: string[] = [];
  let extractTiming = 'extract not measured';
  for (const mode of ['parameters', 'parametersJsonSchema'] as const) {
    const r = await onAvailableModel(preferring(MODEL_EXTRACT), (model) => generate(`V3 extract (${mode})`, model, extractUser, extractConfig(mode), extractEstimate));
    if (!r.response) {
      if (!isServiceError(r.error)) v3status = 'FAIL';
      v3.push(`${mode}: ${errShort(r.error)}`);
      continue;
    }
    const args = callArgs(r, 'submit_state_machine');
    if (args === undefined) {
      v3status = 'FAIL';
      v3.push(`${mode} on ${r.model}: no function call (finish ${finishOf(r)}, text "${short(r.response.text ?? '', 60)}")`);
      continue;
    }
    const valid = validateMachine(args);
    const parsed = StateMachineSchema.safeParse(args);
    const counts = parsed.success ? `${parsed.data.states.length} states, ${parsed.data.events.length} events, ${parsed.data.transitions.length} transitions` : 'shape invalid';
    v3.push(`${mode} on ${r.model}: call returned, ${counts}, validateMachine ${valid.ok ? 'ok' : `failed: ${valid.errors.slice(0, 3).join('; ')}`}`);
    if (valid.ok && parsed.success) {
      declMode = mode;
      v3status = 'PASS';
      extractTiming = `extract on ${r.model} ${r.ms} ms, ${r.response.usageMetadata?.totalTokenCount ?? '?'} tokens`;
      notes.push(`V3 extracted states: ${parsed.data.states.map((s) => s.id).join(', ')}. Checker findings on it: ${runChecks(parsed.data).length}.`);
      break;
    }
    v3status = 'FAIL';
  }
  add('V3', 'Function calling with the nested submit_state_machine schema returns valid args', v3status, v3.join('; '),
    v3status === 'PASS' ? `Pass declarations as \`${declMode}\`.`
      : v3status === 'FAIL' ? 'Simplify the schema (arrays of objects as JSON strings) or use the §7.5 text-JSON fallback.'
      : 'Service errors only; re-run.');

  // ---- V5: forcing a function call. Small declaration to save tokens. ----
  console.info('\nV5 forced function call');
  const answerDecl = {
    name: 'submit_answer',
    description: 'Submit the answer.',
    parameters: { type: 'object', properties: { answer: { type: 'string' } }, required: ['answer'] },
  };
  const v5: string[] = [];
  const v5status: Status[] = [];
  for (const model of MODELS) {
    const r = await generate('V5 toolConfig ANY', model, 'What is the capital of France?', {
      tools: [{ functionDeclarations: [asTool(answerDecl, declMode)] }],
      ...forceCall('submit_answer'),
      maxOutputTokens: 512,
      thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
    }, 700);
    const args = callArgs(r, 'submit_answer');
    if (args !== undefined) {
      v5status.push('PASS');
      v5.push(`${model}: call returned ${short(JSON.stringify(args), 50)}`);
    } else {
      v5status.push(isServiceError(r.error) ? 'NOT TESTED' : 'FAIL');
      v5.push(`${model}: ${r.error ? errShort(r.error) : `no call (finish ${finishOf(r)})`}`);
    }
  }
  const v5final: Status = v5status.includes('FAIL') ? 'FAIL' : v5status.includes('PASS') ? 'PASS' : 'NOT TESTED';
  add('V5', "Forcing a function call with toolConfig mode 'ANY' is accepted", v5final, v5.join('; '),
    v5final === 'PASS' ? 'Accepted. Whether to use it per step depends on V10 (forced vs unforced quality).' : v5final === 'FAIL' ? 'Do not use it; rely on prompts and the §7.5 fallback.' : 'Service errors only; re-run.');

  // ---- V10: realistic analyze and finalize on the fixture, forced and unforced. ----
  console.info('\nV10 realistic analyze and finalize');
  const fixture = StateMachineSchema.parse(machineJson);
  const titles = runChecks(fixture).slice(0, 12).map((f) => f.title);
  const analyzeUser = `MACHINE: ${compactMachine(fixture)}\nALREADY FOUND (do not repeat): ${JSON.stringify(titles)}\nCHECKLIST FOR payments:\n${PAYMENTS_CHECKLIST.map((c, i) => `${i + 1}. ${c}`).join('\n')}`;
  // SPEC §7.2 says thinking HIGH with maxOutputTokens 4000. Thoughts count against maxOutputTokens, so also
  // measure a larger budget and lower levels to see which setting returns usable gaps.
  const analyzeVariants: { tag: string; level: ThinkingLevel; maxOut: number; forced: boolean }[] = [
    { tag: 'SPEC: HIGH 4000 forced', level: ThinkingLevel.HIGH, maxOut: 4000, forced: true },
    { tag: 'SPEC: HIGH 4000', level: ThinkingLevel.HIGH, maxOut: 4000, forced: false },
    { tag: 'HIGH 8000', level: ThinkingLevel.HIGH, maxOut: 8000, forced: false },
    { tag: 'MEDIUM 4000', level: ThinkingLevel.MEDIUM, maxOut: 4000, forced: false },
    { tag: 'LOW 4000', level: ThinkingLevel.LOW, maxOut: 4000, forced: false },
  ];
  const fixtureIds = new Set(fixture.states.map((s) => s.id));
  const v10: string[] = [extractTiming];
  const analyzeSummary: string[] = [];
  for (const v of analyzeVariants) {
    const r = await onAvailableModel(preferring(MODEL_ANALYZE), (model) =>
      generate(`V10 analyze (${v.tag})`, model, analyzeUser, {
        systemInstruction: ANALYZE_SYSTEM_INSTRUCTION,
        tools: [{ functionDeclarations: [asTool(submitGapProposals, declMode)] }],
        maxOutputTokens: v.maxOut,
        thinkingConfig: { thinkingLevel: v.level },
        ...(v.forced ? forceCall('submit_gap_proposals') : {}),
      }, estimateTokens(ANALYZE_SYSTEM_INSTRUCTION, analyzeUser, 0, v.maxOut)));
    const gaps = (callArgs(r, 'submit_gap_proposals') as { gaps?: unknown[] } | undefined)?.gaps;
    // Usable = would survive the §7.2 post-processing: title, description, question, 2-4 options, a known state id.
    const usable = Array.isArray(gaps)
      ? gaps.filter((g) => {
        const x = g as { title?: unknown; description?: unknown; question?: unknown; options?: unknown; stateIds?: unknown };
        return typeof x.title === 'string' && typeof x.description === 'string' && typeof x.question === 'string'
          && Array.isArray(x.options) && x.options.length >= 2 && x.options.length <= 4
          && Array.isArray(x.stateIds) && x.stateIds.some((id) => typeof id === 'string' && fixtureIds.has(id));
      })
      : [];
    const outcome = Array.isArray(gaps) ? `${gaps.length} gaps (${usable.length} usable)` : `no call (finish ${finishOf(r)})`;
    analyzeSummary.push(`${v.tag}: ${outcome}`);
    v10.push(r.response
      ? `analyze ${v.tag} on ${r.model} ${r.ms} ms, ${r.response.usageMetadata?.totalTokenCount ?? '?'} tokens (thoughts ${r.response.usageMetadata?.thoughtsTokenCount ?? 0}), ${outcome}`
      : `analyze ${v.tag}: ${errShort(r.error)}`);
    if (usable.length > 0) {
      const titles = usable.map((g) => `[${(g as { severity?: string }).severity ?? '?'}] ${short((g as { title: string }).title, 60)}`);
      notes.push(`Analyze (${v.tag}) gaps: ${titles.join('; ')}`);
    }
  }

  const allFindings = runChecks(fixture);
  const decided = ['f_missing_handler_s_credit_check_timeout', 'f_dead_end_state_s_credit_declined'];
  const decisions = allFindings.filter((f) => decided.includes(f.id)).map((f, i) => ({
    findingId: f.id, title: f.title, stateIds: f.stateIds, question: f.question.text,
    answer: i === 0 ? 'Show an error and let the user retry' : 'Back to Cart',
  }));
  const finalizeUser = `MACHINE: ${compactMachine(fixture)}\nDECISIONS: ${JSON.stringify(decisions)}`;
  const finalizeConfig = (forced: boolean): GenerateContentConfig => ({
    systemInstruction: FINALIZE_SYSTEM_INSTRUCTION,
    tools: [{ functionDeclarations: [asTool(submitFinalization, declMode)] }],
    maxOutputTokens: 3500,
    thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
    ...(forced ? forceCall('submit_finalization') : {}),
  });
  let finalizeOk = false;
  for (const forced of [false, true]) {
    const tag = forced ? 'forced' : 'unforced';
    const r = await onAvailableModel(preferring(MODEL_FINALIZE), (model) =>
      generate(`V10 finalize (${tag})`, model, finalizeUser, finalizeConfig(forced), estimateTokens(FINALIZE_SYSTEM_INSTRUCTION, finalizeUser, 0, 3500)));
    const args = callArgs(r, 'submit_finalization') as { patch?: unknown } | undefined;
    let note = r.response
      ? `finalize ${tag} on ${r.model} ${r.ms} ms, ${r.response.usageMetadata?.totalTokenCount ?? '?'} tokens`
      : `finalize ${tag}: ${errShort(r.error)}`;
    if (args) {
      const patch = PatchSchema.safeParse(args.patch);
      if (patch.success) {
        const applied = applyPatch(fixture, patch.data);
        const valid = validateMachine(applied.machine);
        finalizeOk ||= valid.ok;
        note += `, patch +${patch.data.states.length}s/+${patch.data.events.length}e/+${patch.data.transitions.length}t, ${applied.warnings.length} warnings, patched machine ${valid.ok ? 'valid' : 'invalid'}, ${runChecks(applied.machine).length} findings remain`;
      } else note += `, patch failed zod (${short(patch.error.issues.slice(0, 2).map((i) => `${i.path.join('.')}: ${i.message}`).join('; '), 120)})`;
    } else if (r.response) note += `, no call (finish ${finishOf(r)}, text "${short(r.response.text ?? '', 60)}")`;
    v10.push(note);
  }

  // Model choice (SPEC §15: the spike decides): can the faster model do the extract step as well?
  const altModel = MODELS.find((m) => m !== MODEL_EXTRACT);
  if (altModel) {
    const read = await generate('V10 sketch read on alt model', altModel,
      createUserContent([createPartFromBase64(base64, 'image/jpeg'), readPrompt]), imageConfig, 2000);
    v10.push(read.response
      ? `sketch read on ${altModel} ${read.ms} ms: "${short(read.response.text ?? '', 60)}" (${readsSketch(read.response.text ?? '') ? 'correct' : 'wrong'})`
      : `sketch read on ${altModel}: ${errShort(read.error)}`);
    const ext = await generate('V10 extract on alt model', altModel, extractUser, extractConfig(declMode), extractEstimate);
    const args = callArgs(ext, 'submit_state_machine');
    const valid = args === undefined ? undefined : validateMachine(args);
    v10.push(ext.response
      ? `extract on ${altModel} ${ext.ms} ms, ${ext.response.usageMetadata?.totalTokenCount ?? '?'} tokens, ${valid === undefined ? `no call (finish ${finishOf(ext)})` : valid.ok ? 'valid machine' : `invalid: ${valid.errors.slice(0, 2).join('; ')}`}`
      : `extract on ${altModel}: ${errShort(ext.error)}`);
  }

  const timed = calls.some((c) => c.label.startsWith('V3 extract') && c.total !== undefined)
    && calls.some((c) => c.label.startsWith('V10 analyze') && c.total !== undefined)
    && calls.some((c) => c.label.startsWith('V10 finalize') && c.total !== undefined);
  add('V10', 'Time per call for each step with realistic input', timed ? 'PASS' : 'NOT TESTED', v10.join('; '),
    'Times recorded; copy to FINAL_REPORT. ' +
      `Analyze: ${analyzeSummary.join('; ')}. Finalize produced a valid patch: ${finalizeOk ? 'yes' : 'no'}.`);

  rows.sort((a, b) => Number(a.id.slice(1)) - Number(b.id.slice(1)));
  writeReport(sdkVersion);
}

main().catch((e: unknown) => {
  console.error(`Spike crashed: ${errorText(e).message}`);
  process.exitCode = 1;
});
