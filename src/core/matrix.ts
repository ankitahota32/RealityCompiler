import { kindsOut, reachableStates, requiredKinds } from './checker';
import { HANDLER_KINDS, type MatrixRow, type StateMachine } from './types';

/**
 * Completeness matrix (SPEC §6.5): one row per reachable, non-terminal state, in machine order.
 * Without exactly one initial state reachability is undefined, so there are no rows.
 */
export function buildMatrix(machine: StateMachine): MatrixRow[] {
  const reachable = reachableStates(machine);
  if (reachable === null) return [];
  const kinds = kindsOut(machine);
  const rows: MatrixRow[] = [];
  for (const s of machine.states) {
    if (!reachable.has(s.id) || s.terminal !== 'none') continue;
    const required = requiredKinds(s);
    const row: MatrixRow = { stateId: s.id, label: s.label, timeout: 'na', failure: 'na', cancel: 'na', duplicate: 'na' };
    for (const kind of HANDLER_KINDS) {
      if (required.has(kind)) row[kind] = kinds.get(s.id)?.has(kind) ? 'handled' : 'missing';
    }
    rows.push(row);
  }
  return rows;
}
