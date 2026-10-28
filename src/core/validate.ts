import type { z } from 'zod';
import { StateMachineSchema, type StateMachine } from './types';

export type ValidateResult = { ok: true } | { ok: false; errors: string[] };

/** Turns zod issues into readable lines: `states.2.id: Invalid string`. */
export function formatZodIssues(error: z.ZodError): string[] {
  return error.issues.map((issue) => {
    const path = issue.path.map(String).join('.');
    return path ? `${path}: ${issue.message}` : issue.message;
  });
}

function duplicates(ids: string[]): string[] {
  const seen = new Set<string>();
  const dupes = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) dupes.add(id);
    seen.add(id);
  }
  return [...dupes];
}

/** Zod schema plus the integrity rules of SPEC §5.1. */
export function validateMachine(m: unknown): ValidateResult {
  const parsed = StateMachineSchema.safeParse(m);
  if (!parsed.success) return { ok: false, errors: formatZodIssues(parsed.error) };
  const machine: StateMachine = parsed.data;
  const errors: string[] = [];

  for (const id of duplicates(machine.states.map((s) => s.id))) errors.push(`Duplicate state id ${id}`);
  for (const id of duplicates(machine.events.map((e) => e.id))) errors.push(`Duplicate event id ${id}`);
  for (const id of duplicates(machine.transitions.map((t) => t.id))) errors.push(`Duplicate transition id ${id}`);

  const stateIds = new Set(machine.states.map((s) => s.id));
  const eventIds = new Set(machine.events.map((e) => e.id));
  for (const t of machine.transitions) {
    if (!stateIds.has(t.from)) errors.push(`Transition ${t.id} starts at unknown state ${t.from}`);
    if (!eventIds.has(t.event)) errors.push(`Transition ${t.id} uses unknown event ${t.event}`);
    if (!stateIds.has(t.to)) errors.push(`Transition ${t.id} goes to unknown state ${t.to}`);
  }

  // Zero or several initial states are allowed here; the checker reports them (§5.1 rule 3).
  for (const s of machine.states) {
    if (s.initial && s.terminal !== 'none') errors.push(`State ${s.id} cannot be both the start and an end state`);
  }

  return errors.length > 0 ? { ok: false, errors } : { ok: true };
}
