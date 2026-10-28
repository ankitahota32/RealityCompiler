import type { EventKind, Scenario, Severity, StateMachine } from './types';

const PRIORITY: Record<EventKind, Severity> = {
  timeout: 'high',
  failure: 'high',
  duplicate: 'high',
  user_action: 'medium',
  system: 'medium',
  cancel: 'low',
};

const WHEN: Record<EventKind, (event: string) => string> = {
  user_action: (e) => `the user does "${e}"`,
  system: (e) => `the system reports "${e}"`,
  timeout: (e) => `the wait times out ("${e}")`,
  failure: (e) => `a failure occurs ("${e}")`,
  cancel: (e) => `the user cancels ("${e}")`,
  duplicate: (e) => `the user repeats the action ("${e}")`,
};

/** One Given/When/Then scenario per transition, in machine order (SPEC §11.6). */
export function generateTransitionScenarios(machine: StateMachine): Scenario[] {
  const stateLabel = (id: string) => machine.states.find((s) => s.id === id)?.label ?? id;
  return machine.transitions.map((t) => {
    const event = machine.events.find((e) => e.id === t.event);
    const eventLabel = event?.label ?? t.event;
    const kind: EventKind = event?.kind ?? 'system';
    const from = stateLabel(t.from);
    const to = stateLabel(t.to);
    return {
      id: `sc_t_${t.id}`,
      origin: 'transition',
      title: `${from} → ${to} on "${eventLabel}"`.slice(0, 140),
      priority: PRIORITY[kind],
      steps: [
        { keyword: 'Given', text: `the flow is in "${from}"` },
        { keyword: 'When', text: WHEN[kind](eventLabel) },
        { keyword: 'Then', text: t.from === t.to ? `the flow stays in "${to}"` : `the flow moves to "${to}"` },
      ],
      coversTransitionIds: [t.id],
      coversFindingIds: [],
    };
  });
}

/** Export order (SPEC §11.3, §11.4): decision scenarios as given, then transition scenarios in machine transition order. */
export function orderScenarios(scenarios: Scenario[], machine: StateMachine): Scenario[] {
  const position = new Map(machine.transitions.map((t, i) => [t.id, i]));
  const rank = (s: Scenario) => position.get(s.coversTransitionIds[0] ?? '') ?? machine.transitions.length;
  const decision = scenarios.filter((s) => s.origin === 'decision');
  const transition = scenarios.filter((s) => s.origin === 'transition').sort((a, b) => rank(a) - rank(b));
  return [...decision, ...transition];
}
