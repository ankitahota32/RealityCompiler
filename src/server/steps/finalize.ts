import { runChecks } from '../../core/checker';
import { buildMatrix } from '../../core/matrix';
import { mergeFindings } from '../../core/merge';
import { applyPatch } from '../../core/patch';
import { generateTransitionScenarios } from '../../core/scenarios';
import {
  PatchSchema,
  SEVERITIES,
  type Decision,
  type Finding,
  type MatrixRow,
  type Rule,
  type Scenario,
  type Severity,
  type StateMachine,
} from '../../core/types';
import { formatZodIssues, validateMachine } from '../../core/validate';
import { addUsage, ZERO_USAGE, type GemmaClient, type Usage } from '../gemma/client';
import { submitFinalization } from '../gemma/declarations';
import { FINALIZE_SYSTEM_INSTRUCTION } from '../gemma/prompts';
import { AppError } from '../http';
import { compactMachine } from './analyze';

// Step 3 (SPEC §7.2): decisions → patch, rules and scenarios; code applies, checks and fills in transition scenarios.

export interface FinalizeInput { machine: StateMachine; findings: Finding[]; decisions: Decision[] }
export interface FinalizeResult {
  machine: StateMachine;
  rules: Rule[];
  scenarios: Scenario[];
  assumptions: string[];
  remainingFindings: Finding[];
  resolvedFindingIds: string[];
  acceptedFindingIds: string[];
  matrix: MatrixRow[];
  usage: Usage;
  warnings: string[];
}

const KEYWORDS = ['Given', 'When', 'Then', 'And'] as const;
type Keyword = (typeof KEYWORDS)[number];
const isString = (v: unknown): v is string => typeof v === 'string';
const asArray = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const asRecord = (v: unknown): Record<string, unknown> => (typeof v === 'object' && v !== null ? (v as Record<string, unknown>) : {});

/** AI rules → `r_<n>`. Rules without text are dropped; finding ids are kept only if they exist. */
function toRules(raw: unknown, findingIds: Set<string>): Rule[] {
  const rules: Rule[] = [];
  for (const item of asArray(raw)) {
    const r = asRecord(item);
    if (!isString(r.text) || r.text.trim() === '') continue;
    rules.push({
      id: `r_${rules.length + 1}`,
      text: r.text.slice(0, 300),
      findingIds: asArray(r.findingIds).filter(isString).filter((id) => findingIds.has(id)),
    });
  }
  return rules;
}

/** AI scenarios → `sc_ai_<n>` (origin 'decision'). Bad steps are dropped; a scenario needs 2 steps, at most 8 are kept. */
function toScenarios(raw: unknown, findingIds: Set<string>): Scenario[] {
  const scenarios: Scenario[] = [];
  for (const item of asArray(raw)) {
    const s = asRecord(item);
    if (!isString(s.title) || s.title.trim() === '') continue;
    const steps = asArray(s.steps)
      .map(asRecord)
      .filter((st) => (KEYWORDS as readonly unknown[]).includes(st.keyword) && isString(st.text) && st.text.trim() !== '')
      .map((st) => ({ keyword: st.keyword as Keyword, text: (st.text as string).slice(0, 200) }))
      .slice(0, 8);
    if (steps.length < 2) continue;
    scenarios.push({
      id: `sc_ai_${scenarios.length + 1}`,
      origin: 'decision',
      title: s.title.slice(0, 140),
      priority: (SEVERITIES as readonly unknown[]).includes(s.priority) ? (s.priority as Severity) : 'medium',
      steps,
      coversTransitionIds: [],
      coversFindingIds: asArray(s.findingIds).filter(isString).filter((id) => findingIds.has(id)),
    });
  }
  return scenarios;
}

type PatchAttempt =
  | { ok: true; machine: StateMachine; warnings: string[]; args: Record<string, unknown> }
  | { ok: false; errors: string[] };

function tryPatch(machine: StateMachine, args: unknown): PatchAttempt {
  const a = asRecord(args);
  const patch = PatchSchema.safeParse(a.patch);
  if (!patch.success) return { ok: false, errors: formatZodIssues(patch.error).map((e) => `patch.${e}`) };
  const applied = applyPatch(machine, patch.data);
  const valid = validateMachine(applied.machine);
  if (!valid.ok) return { ok: false, errors: valid.errors };
  return { ok: true, machine: applied.machine, warnings: applied.warnings, args: a };
}

export async function runFinalize(input: FinalizeInput, deps: { client: GemmaClient; model: string }): Promise<FinalizeResult> {
  const { machine, findings, decisions } = input;
  const byId = new Map(findings.map((f) => [f.id, f]));
  const findingIds = new Set(byId.keys());
  const actionable = decisions.filter((d) => (d.answerType === 'option' || d.answerType === 'custom') && byId.has(d.findingId));

  let finalMachine = machine;
  let warnings: string[] = [];
  let args: Record<string, unknown> = {};
  let usage = ZERO_USAGE;

  if (actionable.length > 0) {
    const decisionData = actionable.map((d) => {
      const f = byId.get(d.findingId) as Finding;
      return { findingId: f.id, title: f.title, stateIds: f.stateIds, question: f.question.text, answer: d.answer };
    });
    const baseText = `MACHINE: ${compactMachine(machine)}\nDECISIONS: ${JSON.stringify(decisionData)}`;
    const call = (userText: string) =>
      deps.client.call({
        step: 'finalize',
        model: deps.model,
        systemInstruction: FINALIZE_SYSTEM_INSTRUCTION,
        userText,
        functionDeclaration: submitFinalization,
        thinking: 'minimal',
        maxOutputTokens: 3500,
      });

    const first = await call(baseText);
    usage = first.usage;
    let attempt = tryPatch(machine, first.args);
    if (!attempt.ok) {
      const second = await call(
        `${baseText}\n\nYOUR PREVIOUS PATCH WAS INVALID: ${attempt.errors.join('; ')}. Call submit_finalization again with a corrected patch.`,
      );
      usage = addUsage(usage, second.usage);
      attempt = tryPatch(machine, second.args);
      if (!attempt.ok) throw new AppError('MODEL_OUTPUT_INVALID', 'The model returned an invalid patch twice.');
    }
    finalMachine = attempt.machine;
    warnings = attempt.warnings;
    args = attempt.args;
  }

  const before = runChecks(machine);
  const after = runChecks(finalMachine);
  const afterIds = new Set(after.map((f) => f.id));
  const decidedIds = new Set(actionable.map((d) => d.findingId));
  const aiFindings = findings.filter((f) => f.source === 'ai');

  return {
    machine: finalMachine,
    rules: toRules(args.rules, findingIds),
    scenarios: [...toScenarios(args.scenarios, findingIds), ...generateTransitionScenarios(finalMachine)],
    assumptions: asArray(args.assumptions).filter(isString),
    remainingFindings: mergeFindings(after, aiFindings.filter((f) => !decidedIds.has(f.id))),
    resolvedFindingIds: [
      ...before.filter((f) => !afterIds.has(f.id)).map((f) => f.id),
      ...aiFindings.filter((f) => decidedIds.has(f.id)).map((f) => f.id),
    ],
    acceptedFindingIds: decisions.filter((d) => d.answerType === 'accepted' && findingIds.has(d.findingId)).map((d) => d.findingId),
    matrix: buildMatrix(finalMachine),
    usage,
    warnings,
  };
}
