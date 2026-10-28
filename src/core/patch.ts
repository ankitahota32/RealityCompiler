import type { Patch, StateMachine } from './types';

const CAPS = { states: 25, events: 40, transitions: 60 } as const;

/** Adds the patch to the machine (SPEC §7.4). Add-only, never throws; dropped items become warnings. */
export function applyPatch(machine: StateMachine, patch: Patch): { machine: StateMachine; warnings: string[] } {
  const warnings: string[] = [];
  const capWarned = new Set<keyof typeof CAPS>();
  const cap = (kind: keyof typeof CAPS) => {
    if (!capWarned.has(kind)) warnings.push(`PATCH_CAP:${kind}`);
    capWarned.add(kind);
  };

  const states = [...machine.states];
  const stateIds = new Set(states.map((s) => s.id));
  for (const s of patch.states) {
    if (stateIds.has(s.id)) {
      warnings.push(`PATCH_DUPLICATE_ID:${s.id}`);
    } else if (states.length >= CAPS.states) {
      cap('states');
    } else {
      states.push({ ...s, initial: false });
      stateIds.add(s.id);
    }
  }

  const events = [...machine.events];
  const eventIds = new Set(events.map((e) => e.id));
  for (const e of patch.events) {
    if (eventIds.has(e.id)) {
      warnings.push(`PATCH_DUPLICATE_ID:${e.id}`);
    } else if (events.length >= CAPS.events) {
      cap('events');
    } else {
      events.push({ ...e });
      eventIds.add(e.id);
    }
  }

  const transitions = [...machine.transitions];
  const transitionIds = new Set(transitions.map((t) => t.id));
  for (const t of patch.transitions) {
    if (transitionIds.has(t.id)) {
      warnings.push(`PATCH_DUPLICATE_ID:${t.id}`);
    } else if (!stateIds.has(t.from) || !stateIds.has(t.to) || !eventIds.has(t.event)) {
      warnings.push(`PATCH_BAD_REF:${t.id}`);
    } else if (transitions.length >= CAPS.transitions) {
      cap('transitions');
    } else {
      transitions.push({ ...t });
      transitionIds.add(t.id);
    }
  }

  return { machine: { ...machine, states, events, transitions }, warnings };
}
