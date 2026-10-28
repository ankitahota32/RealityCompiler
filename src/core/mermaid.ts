import type { StateMachine } from './types';

/** Mermaid label rules (SPEC §11.1): replace, collapse spaces, trim, cut to 40; empty becomes the id. */
export function sanitizeLabel(label: string, fallbackId: string): string {
  const clean = label
    .replace(/[^A-Za-z0-9 _\-/().,']/g, ' ')
    .replace(/ +/g, ' ')
    .trim()
    .slice(0, 40);
  return clean === '' ? fallbackId : clean;
}

/** `stateDiagram-v2` text for the machine (SPEC §11.1). No trailing newline. */
export function toMermaid(machine: StateMachine): string {
  const lines = ['stateDiagram-v2', '  direction LR'];
  for (const s of machine.states) lines.push(`  state "${sanitizeLabel(s.label, s.id)}" as ${s.id}`);
  const initials = machine.states.filter((s) => s.initial);
  if (initials.length === 1 && initials[0] !== undefined) lines.push(`  [*] --> ${initials[0].id}`);
  for (const s of machine.states) {
    if (s.terminal !== 'none') lines.push(`  ${s.id} --> [*]`);
  }
  for (const t of machine.transitions) {
    const event = machine.events.find((e) => e.id === t.event);
    lines.push(`  ${t.from} --> ${t.to} : ${sanitizeLabel(event?.label ?? '', t.event)}`);
  }
  return lines.join('\n');
}
