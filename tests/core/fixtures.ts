import machineJson from '../../fixtures/bnpl.machine.json';
import finalizationJson from '../../fixtures/bnpl.finalization.json';
import { runChecks } from '@/core/checker';
import { applyPatch } from '@/core/patch';
import { generateTransitionScenarios } from '@/core/scenarios';
import {
  PatchSchema,
  StateMachineSchema,
  type Decision,
  type EventKind,
  type ExportData,
  type Rule,
  type Scenario,
  type State,
  type StateMachine,
} from '@/core/types';

/** A fresh copy of the Appendix A machine. */
export function bnplMachine(): StateMachine {
  return StateMachineSchema.parse(structuredClone(machineJson));
}

/** The Appendix D patch. */
export function bnplPatch() {
  return PatchSchema.parse(structuredClone(finalizationJson.patch));
}

const KIND_BY_EVENT: Record<string, EventKind> = {
  e_timeout: 'timeout', e_failure: 'failure', e_cancel: 'cancel', e_duplicate: 'duplicate', e_system: 'system',
};

/**
 * Compact machine builder for rule tests. States are `[id, overrides]`; transitions are `[from, eventId, to]`.
 * Events are created from the ids used: `e_timeout`, `e_failure`, `e_cancel`, `e_duplicate`, `e_system`
 * get that kind, anything else is a user action.
 */
export function build(
  states: [string, Partial<State>?][],
  transitions: [string, string, string][],
): StateMachine {
  const eventIds = [...new Set(transitions.map(([, e]) => e))];
  return {
    name: 'Test',
    flowType: 'generic',
    states: states.map(([id, o]) => ({
      id, label: id.slice(2), initial: false, terminal: 'none', awaitsExternal: false, userInput: false,
      evidence: '', confidence: 1, ...o,
    })),
    events: eventIds.map((id) => ({ id, label: id.slice(2), kind: KIND_BY_EVENT[id] ?? 'user_action', evidence: '', confidence: 1 })),
    transitions: transitions.map(([from, event, to], i) => ({ id: `t_${i + 1}`, from, event, to, evidence: '', confidence: 1 })),
  };
}

/** A small valid machine to edit in tests: a (start) -> b (success). */
export function tinyMachine(): StateMachine {
  return {
    name: 'Tiny',
    flowType: 'generic',
    states: [
      { id: 's_a', label: 'A', initial: true, terminal: 'none', awaitsExternal: false, userInput: false, evidence: '', confidence: 1 },
      { id: 's_b', label: 'B', initial: false, terminal: 'success', awaitsExternal: false, userInput: false, evidence: '', confidence: 1 },
    ],
    events: [{ id: 'e_go', label: 'Go', kind: 'user_action', evidence: '', confidence: 1 }],
    transitions: [{ id: 't_go', from: 's_a', event: 'e_go', to: 's_b', evidence: '', confidence: 1 }],
  };
}

/**
 * The end-of-flow data for the fixture, built the way /api/finalize will build it:
 * Appendix A + Appendix D patch, AI rules and scenarios from Appendix D, transition scenarios by code.
 */
export function bnplExportData(): ExportData {
  const before = bnplMachine();
  const findings = runChecks(before);
  const { machine } = applyPatch(before, bnplPatch());
  const remainingFindings = runChecks(machine);
  const remainingIds = new Set(remainingFindings.map((f) => f.id));
  const rules: Rule[] = finalizationJson.rules.map((r, i) => ({ id: `r_${i + 1}`, text: r.text, findingIds: r.findingIds }));
  const decisionScenarios: Scenario[] = finalizationJson.scenarios.map((s, i) => ({
    id: `sc_ai_${i + 1}`,
    origin: 'decision',
    title: s.title,
    priority: s.priority as Scenario['priority'],
    steps: s.steps.map((st) => ({ keyword: st.keyword as Scenario['steps'][number]['keyword'], text: st.text })),
    coversTransitionIds: [],
    coversFindingIds: s.findingIds,
  }));
  const decisions: Decision[] = [
    { findingId: 'f_missing_handler_s_credit_check_timeout', answerType: 'option', answer: 'Show an error and let the user retry' },
    { findingId: 'f_dead_end_state_s_credit_declined', answerType: 'custom', answer: 'Let them go back to the cart' },
    { findingId: 'f_no_failure_terminal_machine', answerType: 'accepted', answer: '' },
    { findingId: 'f_unreachable_state_s_referral', answerType: 'skip', answer: '' },
  ];
  return {
    machine,
    rules,
    scenarios: [...decisionScenarios, ...generateTransitionScenarios(machine)],
    assumptions: finalizationJson.assumptions,
    remainingFindings,
    resolvedFindingIds: findings.filter((f) => !remainingIds.has(f.id)).map((f) => f.id),
    acceptedFindingIds: ['f_no_failure_terminal_machine'],
    decisions,
    findings,
    generatedAt: '2026-10-29',
  };
}
