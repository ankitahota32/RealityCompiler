import { runChecks } from '../../core/checker';
import { buildMatrix } from '../../core/matrix';
import { mergeFindings } from '../../core/merge';
import {
  CATEGORIES,
  SEVERITIES,
  type Category,
  type Finding,
  type MatrixRow,
  type Severity,
  type StateMachine,
} from '../../core/types';
import { getPack } from '../../packs';
import { ZERO_USAGE, type GemmaClient, type Usage } from '../gemma/client';
import { submitGapProposals } from '../gemma/declarations';
import { ANALYZE_SYSTEM_INSTRUCTION } from '../gemma/prompts';

// Step 2 (SPEC §7.2): checker first, then one Gemma call for business and risk gaps.

export interface AnalyzeResult { findings: Finding[]; matrix: MatrixRow[]; usage: Usage; warnings: string[] }

/** The machine without evidence and confidence, on one line (SPEC §7.2). */
export function compactMachine(m: StateMachine): string {
  return JSON.stringify({
    states: m.states.map(({ id, label, initial, terminal, awaitsExternal, userInput }) => ({ id, label, initial, terminal, awaitsExternal, userInput })),
    events: m.events.map(({ id, label, kind }) => ({ id, label, kind })),
    transitions: m.transitions.map(({ id, from, event, to }) => ({ id, from, event, to })),
  });
}

export function analyzeUserText(machine: StateMachine, checkerFindings: Finding[]): string {
  const titles = checkerFindings.slice(0, 12).map((f) => f.title);
  const checklist = getPack(machine.flowType).map((item, i) => `${i + 1}. ${item}`).join('\n');
  return `MACHINE: ${compactMachine(machine)}\nALREADY FOUND (do not repeat): ${JSON.stringify(titles)}\nCHECKLIST FOR ${machine.flowType}:\n${checklist}`;
}

const AI_CATEGORIES = CATEGORIES.filter((c) => c !== 'structure');
const isString = (v: unknown): v is string => typeof v === 'string';
const nonEmpty = (v: unknown): v is string => isString(v) && v.trim() !== '';

/**
 * Raw `submit_gap_proposals` args → AI findings (SPEC §7.2 step 2 post-processing). Never throws.
 * Drops gaps missing title/description/question or without 2-4 string options, cuts strings to the schema
 * limits, removes unknown state ids, drops gaps left without a state, keeps at most 8.
 */
export function proposalsToFindings(raw: unknown, machine: StateMachine): Finding[] {
  const gaps = (raw as { gaps?: unknown } | null | undefined)?.gaps;
  if (!Array.isArray(gaps)) return [];
  const known = new Set(machine.states.map((s) => s.id));
  const findings: Finding[] = [];
  for (const gap of gaps) {
    if (findings.length >= 8) break;
    if (typeof gap !== 'object' || gap === null) continue;
    const g = gap as Record<string, unknown>;
    if (!nonEmpty(g.title) || !nonEmpty(g.description) || !nonEmpty(g.question)) continue;
    if (!Array.isArray(g.options) || g.options.length < 2 || g.options.length > 4 || !g.options.every(nonEmpty)) continue;
    const stateIds = Array.isArray(g.stateIds) ? [...new Set(g.stateIds.filter(isString).filter((id) => known.has(id)))] : [];
    if (stateIds.length === 0) continue;
    const severity: Severity = (SEVERITIES as readonly unknown[]).includes(g.severity) ? (g.severity as Severity) : 'medium';
    const category: Category = (AI_CATEGORIES as readonly unknown[]).includes(g.category) ? (g.category as Category) : 'business_rule';
    findings.push({
      id: `f_ai_${findings.length + 1}`,
      source: 'ai',
      ruleId: 'AI_GAP',
      severity,
      category,
      title: g.title.slice(0, 120),
      description: g.description.slice(0, 400),
      stateIds,
      question: { text: g.question.slice(0, 200), options: g.options.map((o) => o.slice(0, 80)) },
    });
  }
  return findings;
}

export async function runAnalyze(machine: StateMachine, deps: { client: GemmaClient; model: string }): Promise<AnalyzeResult> {
  const checker = runChecks(machine);
  let ai: Finding[] = [];
  let usage = ZERO_USAGE;
  const warnings: string[] = [];
  try {
    const result = await deps.client.call({
      step: 'analyze',
      model: deps.model,
      systemInstruction: ANALYZE_SYSTEM_INSTRUCTION,
      userText: analyzeUserText(machine, checker),
      functionDeclaration: submitGapProposals,
      thinking: 'high',
      // SPEC says 4000; HIGH thinking used all of it in the spike and returned nothing (docs/DECISIONS.md, M2).
      maxOutputTokens: 8000,
    });
    usage = result.usage;
    ai = proposalsToFindings(result.args, machine);
  } catch {
    // Any model failure (after retries) keeps the checker findings (SPEC §7.2).
    warnings.push('AI_GAPS_UNAVAILABLE');
  }
  return { findings: mergeFindings(checker, ai), matrix: buildMatrix(machine), usage, warnings };
}
