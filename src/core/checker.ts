import { mergeFindings } from './merge';
import { buildQuestion, type QuestionInput } from './questions';
import {
  HANDLER_KINDS,
  type CheckerRule,
  type Finding,
  type HandlerKind,
  type Severity,
  type State,
  type StateMachine,
} from './types';

const SEVERITY: Record<Exclude<CheckerRule, 'MISSING_HANDLER'>, Severity> = {
  NO_INITIAL: 'high',
  MULTIPLE_INITIAL: 'high',
  NO_SUCCESS_TERMINAL: 'high',
  NO_FAILURE_TERMINAL: 'medium',
  UNREACHABLE_STATE: 'medium',
  DEAD_END_STATE: 'high',
  NO_PATH_TO_TERMINAL: 'high',
  TERMINAL_HAS_OUTGOING: 'low',
  NONDETERMINISTIC: 'high',
};

const DESCRIPTION: Record<Exclude<CheckerRule, 'MISSING_HANDLER'>, string> = {
  NO_INITIAL: 'Nothing marks where the flow begins, so it is unclear what users see first.',
  MULTIPLE_INITIAL: 'Several states are marked as the start, so it is unclear where the flow begins.',
  NO_SUCCESS_TERMINAL: 'No state marks a successful finish, so nobody can tell when the flow is done.',
  NO_FAILURE_TERMINAL: 'No state marks a failed finish, so it is unclear how users learn that the flow could not complete.',
  UNREACHABLE_STATE: 'No path from the start leads here, so users can never see this state.',
  DEAD_END_STATE: 'Users who arrive here have nowhere to go next and get stuck.',
  NO_PATH_TO_TERMINAL: 'From here the flow can move, but it can never reach an end, so users may go around in circles.',
  TERMINAL_HAS_OUTGOING: 'This is marked as an end, but moves leave it, so it is unclear whether the flow really ends here.',
  NONDETERMINISTIC: 'The same event leads to different states here, so the outcome is unpredictable.',
};

const HANDLER_DESCRIPTION: Record<HandlerKind, string> = {
  timeout: 'If the outside system never answers, users wait here with no way forward.',
  failure: 'If the outside system returns an error, nothing defines what users see or can do.',
  cancel: 'Users cannot leave or go back from here once they arrive.',
  duplicate: 'If users submit twice, the action may run twice (for example a double charge or a duplicate order).',
};

const HANDLER_TITLE: Record<HandlerKind, (state: string) => string> = {
  timeout: (s) => `No timeout handling in "${s}"`,
  failure: (s) => `No failure handling in "${s}"`,
  cancel: (s) => `No way to cancel from "${s}"`,
  duplicate: (s) => `No double-submit handling in "${s}"`,
};

const SEVERITY_RANK: Record<Severity, number> = { high: 0, medium: 1, low: 2 };

/** Handler kinds a state must have, with severity, in kind order (SPEC §6.3). */
export function requiredKinds(s: State): Map<HandlerKind, Severity> {
  const wanted: [HandlerKind, Severity][] = [];
  if (s.awaitsExternal) wanted.push(['timeout', 'high'], ['failure', 'high'], ['cancel', 'medium']);
  if (s.userInput) wanted.push(['cancel', 'medium'], ['duplicate', 'medium']);
  const result = new Map<HandlerKind, Severity>();
  for (const kind of HANDLER_KINDS) {
    for (const [k, sev] of wanted) {
      if (k !== kind) continue;
      const current = result.get(kind);
      if (current === undefined || SEVERITY_RANK[sev] < SEVERITY_RANK[current]) result.set(kind, sev);
    }
  }
  return result;
}

/** Event kinds of the transitions leaving each state. */
export function kindsOut(machine: StateMachine): Map<string, Set<string>> {
  const eventKind = new Map(machine.events.map((e) => [e.id, e.kind]));
  const result = new Map<string, Set<string>>(machine.states.map((s) => [s.id, new Set<string>()]));
  for (const t of machine.transitions) {
    const kind = eventKind.get(t.event);
    if (kind !== undefined) result.get(t.from)?.add(kind);
  }
  return result;
}

/** States reachable from the single initial state (BFS), or null when there is not exactly one. */
export function reachableStates(machine: StateMachine): Set<string> | null {
  const initials = machine.states.filter((s) => s.initial);
  const start = initials[0];
  if (initials.length !== 1 || start === undefined) return null;
  const seen = new Set<string>([start.id]);
  const queue = [start.id];
  while (queue.length > 0) {
    const current = queue.shift();
    for (const t of machine.transitions) {
      if (t.from === current && !seen.has(t.to)) {
        seen.add(t.to);
        queue.push(t.to);
      }
    }
  }
  return seen;
}

/** States from which some terminal state can be reached (reverse BFS). */
function statesReachingTerminal(machine: StateMachine): Set<string> {
  const seen = new Set(machine.states.filter((s) => s.terminal !== 'none').map((s) => s.id));
  const queue = [...seen];
  while (queue.length > 0) {
    const current = queue.shift();
    for (const t of machine.transitions) {
      if (t.to === current && !seen.has(t.from)) {
        seen.add(t.from);
        queue.push(t.from);
      }
    }
  }
  return seen;
}

function findingId(rule: CheckerRule, stateId: string | null, suffix?: string): string {
  return `f_${rule.toLowerCase()}_${stateId ?? 'machine'}${suffix === undefined ? '' : `_${suffix}`}`;
}

/** Runs the structural rules of SPEC §6. Pure and deterministic; returns findings sorted per §6.6. */
export function runChecks(machine: StateMachine): Finding[] {
  const findings: Finding[] = [];
  const label = (stateId: string) => machine.states.find((s) => s.id === stateId)?.label ?? stateId;

  const add = (
    rule: CheckerRule,
    severity: Severity,
    title: string,
    description: string,
    stateIds: string[],
    question: QuestionInput,
    idState: string | null,
    idSuffix?: string,
    requiredKind?: HandlerKind,
  ) => {
    findings.push({
      id: findingId(rule, idState, idSuffix),
      source: 'checker',
      ruleId: rule,
      severity,
      category: 'structure',
      title: title.slice(0, 120),
      description,
      stateIds,
      ...(requiredKind === undefined ? {} : { requiredKind }),
      question: buildQuestion(question, machine),
    });
  };

  const initials = machine.states.filter((s) => s.initial);
  const outgoing = new Map(machine.states.map((s) => [s.id, machine.transitions.filter((t) => t.from === s.id)]));
  const outCount = (stateId: string) => outgoing.get(stateId)?.length ?? 0;
  const reachable = reachableStates(machine);

  // 1-4: machine-level rules.
  if (initials.length === 0) {
    add('NO_INITIAL', SEVERITY.NO_INITIAL, 'No start state', DESCRIPTION.NO_INITIAL, [], { rule: 'NO_INITIAL' }, null);
  }
  if (initials.length > 1) {
    add('MULTIPLE_INITIAL', SEVERITY.MULTIPLE_INITIAL, 'More than one start state', DESCRIPTION.MULTIPLE_INITIAL,
      initials.map((s) => s.id), { rule: 'MULTIPLE_INITIAL' }, null);
  }
  if (!machine.states.some((s) => s.terminal === 'success')) {
    add('NO_SUCCESS_TERMINAL', SEVERITY.NO_SUCCESS_TERMINAL, 'No successful ending', DESCRIPTION.NO_SUCCESS_TERMINAL,
      [], { rule: 'NO_SUCCESS_TERMINAL' }, null);
  }
  if (!machine.states.some((s) => s.terminal === 'failure')) {
    add('NO_FAILURE_TERMINAL', SEVERITY.NO_FAILURE_TERMINAL, 'No failure ending', DESCRIPTION.NO_FAILURE_TERMINAL,
      [], { rule: 'NO_FAILURE_TERMINAL' }, null);
  }

  // 5-7: reachability rules, only with exactly one initial state.
  if (reachable !== null) {
    for (const s of machine.states) {
      if (!reachable.has(s.id)) {
        add('UNREACHABLE_STATE', SEVERITY.UNREACHABLE_STATE, `"${s.label}" can never be reached`,
          DESCRIPTION.UNREACHABLE_STATE, [s.id], { rule: 'UNREACHABLE_STATE', stateId: s.id }, s.id);
      }
    }
    for (const s of machine.states) {
      if (reachable.has(s.id) && s.terminal === 'none' && outCount(s.id) === 0) {
        add('DEAD_END_STATE', SEVERITY.DEAD_END_STATE, `"${s.label}" is a dead end`,
          DESCRIPTION.DEAD_END_STATE, [s.id], { rule: 'DEAD_END_STATE', stateId: s.id }, s.id);
      }
    }
    const reachesTerminal = statesReachingTerminal(machine);
    for (const s of machine.states) {
      if (reachable.has(s.id) && s.terminal === 'none' && outCount(s.id) > 0 && !reachesTerminal.has(s.id)) {
        add('NO_PATH_TO_TERMINAL', SEVERITY.NO_PATH_TO_TERMINAL, `"${s.label}" can never finish`,
          DESCRIPTION.NO_PATH_TO_TERMINAL, [s.id], { rule: 'NO_PATH_TO_TERMINAL', stateId: s.id }, s.id);
      }
    }
  }

  // 8: terminal states with outgoing transitions.
  for (const s of machine.states) {
    if (s.terminal !== 'none' && outCount(s.id) > 0) {
      add('TERMINAL_HAS_OUTGOING', SEVERITY.TERMINAL_HAS_OUTGOING, `End state "${s.label}" has moves leaving it`,
        DESCRIPTION.TERMINAL_HAS_OUTGOING, [s.id], { rule: 'TERMINAL_HAS_OUTGOING', stateId: s.id }, s.id);
    }
  }

  // 9: same from + event with different targets. One finding per (state, event), in state then transition order.
  for (const s of machine.states) {
    const targetsByEvent = new Map<string, string[]>();
    for (const t of outgoing.get(s.id) ?? []) {
      const targets = targetsByEvent.get(t.event) ?? [];
      if (!targets.includes(t.to)) targets.push(t.to);
      targetsByEvent.set(t.event, targets);
    }
    for (const [eventId, targets] of targetsByEvent) {
      if (targets.length < 2) continue;
      const eventLabel = machine.events.find((e) => e.id === eventId)?.label ?? eventId;
      add('NONDETERMINISTIC', SEVERITY.NONDETERMINISTIC, `"${eventLabel}" in "${s.label}" has conflicting outcomes`,
        DESCRIPTION.NONDETERMINISTIC, [s.id],
        { rule: 'NONDETERMINISTIC', stateId: s.id, eventId, targetIds: targets }, s.id, eventId);
    }
  }

  // 10: missing handlers on reachable, non-terminal states.
  if (reachable !== null) {
    const kinds = kindsOut(machine);
    for (const s of machine.states) {
      if (!reachable.has(s.id) || s.terminal !== 'none') continue;
      for (const [kind, severity] of requiredKinds(s)) {
        if (kinds.get(s.id)?.has(kind)) continue;
        add('MISSING_HANDLER', severity, HANDLER_TITLE[kind](label(s.id)), HANDLER_DESCRIPTION[kind], [s.id],
          { rule: 'MISSING_HANDLER', stateId: s.id, kind }, s.id, kind, kind);
      }
    }
  }

  // Findings were emitted in rule, state and kind order; a stable sort by severity gives §6.6.
  return mergeFindings(findings, []);
}
