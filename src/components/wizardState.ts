import { runChecks } from '@/core/checker';
import { mergeFindings } from '@/core/merge';
import { emptyProjectData, parseProjectFile } from '@/core/project';
import {
  PROJECT_FILE_FORMAT,
  PROJECT_FILE_VERSION,
  type Decision,
  type EventKind,
  type Finding,
  type ProjectData,
  type ProjectInput,
  type ProjectResult,
  type State,
  type StateMachine,
} from '@/core/types';

// Wizard state (SPEC §10): one useReducer. Pure, so it is unit tested without a browser.

export type Step = 1 | 2 | 3 | 4;

/** An uploaded image after client-side resize. Memory only: never stored (SPEC §10, §13.8). */
export interface UploadedImage { id: string; blob: Blob; url: string }

export interface WizardState {
  step: Step;
  input: ProjectInput;
  machine: StateMachine | null;
  findings: Finding[];
  decisions: Decision[];
  result: ProjectResult | null;
  images: UploadedImage[];   // memory only
  tokensUsed: number;        // this page session only
  aiUnavailable: boolean;    // last analyze returned AI_GAPS_UNAVAILABLE
  restored: boolean;         // storage was read once; autosave waits for it
}

type Usage = { totalTokens: number };

export type WizardAction =
  | { type: 'input/set'; input: Partial<ProjectInput> }
  | { type: 'images/add'; images: UploadedImage[] }
  | { type: 'images/remove'; id: string }
  | { type: 'extract/done'; machine: StateMachine; usage: Usage }
  | { type: 'demo/loaded'; machine: StateMachine; aiFindings: Finding[] }
  | { type: 'analyze/done'; findings: Finding[]; usage: Usage; warnings: string[] }
  | { type: 'finalize/done'; result: ProjectResult; usage: Usage }
  | { type: 'step/go'; step: Step }
  | { type: 'decision/set'; decision: Decision }
  | { type: 'decision/clear'; findingId: string }
  | { type: 'project/load'; data: ProjectData }
  | { type: 'storage/restored'; data: ProjectData | null }
  | { type: 'reset' }
  | MachineEdit;

export type MachineEdit =
  | { type: 'state/rename'; id: string; label: string }
  | { type: 'state/setStart'; id: string; value: boolean }
  | { type: 'state/setEnd'; id: string; terminal: State['terminal'] }
  | { type: 'state/setFlag'; id: string; flag: 'awaitsExternal' | 'userInput'; value: boolean }
  | { type: 'state/delete'; id: string }
  | { type: 'state/add'; label: string }
  | { type: 'event/rename'; id: string; label: string }
  | { type: 'event/setKind'; id: string; kind: EventKind }
  | { type: 'event/delete'; id: string }
  | { type: 'event/add'; label: string; kind: EventKind }
  | { type: 'transition/add'; from: string; event: string; to: string }
  | { type: 'transition/delete'; id: string };

export function initialState(): WizardState {
  return { ...emptyProjectData(), step: 1, images: [], tokensUsed: 0, aiUnavailable: false, restored: false };
}

/** The ONLY shape written to localStorage or a project file: drops images and token totals (SPEC §5.3). */
export function toProjectData(s: WizardState): ProjectData {
  return { step: s.step, input: s.input, machine: s.machine, findings: s.findings, decisions: s.decisions, result: s.result };
}

/** Next free `<prefix>user_<n>` id (SPEC §10.1: n increments, never collides). */
export function nextUserId(prefix: 's_' | 'e_' | 't_', existing: string[]): string {
  let max = 0;
  const re = new RegExp(`^${prefix}user_(\\d+)$`);
  for (const id of existing) {
    const m = re.exec(id);
    if (m?.[1] !== undefined) max = Math.max(max, Number(m[1]));
  }
  let n = max + 1;
  while (existing.includes(`${prefix}user_${n}`)) n += 1;
  return `${prefix}user_${n}`;
}

/** Labels are 1 to 60 characters; an empty label is not applied. */
const cleanLabel = (label: string) => label.replace(/\s+/g, ' ').trim().slice(0, 60);

const USER_ITEM = { evidence: 'Added by the user', confidence: 1 } as const;

function editMachine(m: StateMachine, a: MachineEdit): StateMachine {
  const mapState = (id: string, f: (s: State) => State) => ({ ...m, states: m.states.map((s) => (s.id === id ? f(s) : s)) });
  switch (a.type) {
    case 'state/rename': {
      const label = cleanLabel(a.label);
      return label ? mapState(a.id, (s) => ({ ...s, label })) : m;
    }
    case 'state/setStart':
      // Only one start at a time; a start state cannot also be an end (SPEC §5.1 rule 4).
      return {
        ...m,
        states: m.states.map((s) =>
          s.id === a.id
            ? { ...s, initial: a.value, terminal: a.value ? 'none' : s.terminal }
            : a.value ? { ...s, initial: false } : s,
        ),
      };
    case 'state/setEnd':
      return mapState(a.id, (s) => ({ ...s, terminal: a.terminal, initial: a.terminal === 'none' ? s.initial : false }));
    case 'state/setFlag':
      return mapState(a.id, (s) => ({ ...s, [a.flag]: a.value }));
    case 'state/delete':
      return {
        ...m,
        states: m.states.filter((s) => s.id !== a.id),
        transitions: m.transitions.filter((t) => t.from !== a.id && t.to !== a.id),
      };
    case 'state/add': {
      const label = cleanLabel(a.label);
      if (!label || m.states.length >= 25) return m;
      const id = nextUserId('s_', m.states.map((s) => s.id));
      return {
        ...m,
        states: [...m.states, { id, label, initial: false, terminal: 'none', awaitsExternal: false, userInput: false, ...USER_ITEM }],
      };
    }
    case 'event/rename': {
      const label = cleanLabel(a.label);
      return label ? { ...m, events: m.events.map((e) => (e.id === a.id ? { ...e, label } : e)) } : m;
    }
    case 'event/setKind':
      return { ...m, events: m.events.map((e) => (e.id === a.id ? { ...e, kind: a.kind } : e)) };
    case 'event/delete':
      return { ...m, events: m.events.filter((e) => e.id !== a.id), transitions: m.transitions.filter((t) => t.event !== a.id) };
    case 'event/add': {
      const label = cleanLabel(a.label);
      if (!label || m.events.length >= 40) return m;
      const id = nextUserId('e_', m.events.map((e) => e.id));
      return { ...m, events: [...m.events, { id, label, kind: a.kind, ...USER_ITEM }] };
    }
    case 'transition/add': {
      const known = (ids: string[], id: string) => ids.includes(id);
      if (
        !known(m.states.map((s) => s.id), a.from) || !known(m.states.map((s) => s.id), a.to) ||
        !known(m.events.map((e) => e.id), a.event) || m.transitions.length >= 60
      ) return m;
      const id = nextUserId('t_', m.transitions.map((t) => t.id));
      return { ...m, transitions: [...m.transitions, { id, from: a.from, event: a.event, to: a.to, ...USER_ITEM }] };
    }
    case 'transition/delete':
      return { ...m, transitions: m.transitions.filter((t) => t.id !== a.id) };
  }
}

/** Keeps only decisions whose finding still exists. */
const keepDecisions = (decisions: Decision[], findings: Finding[]) => {
  const ids = new Set(findings.map((f) => f.id));
  return decisions.filter((d) => ids.has(d.findingId));
};

export function wizardReducer(s: WizardState, a: WizardAction): WizardState {
  switch (a.type) {
    case 'input/set':
      return { ...s, input: { ...s.input, ...a.input } };
    case 'images/add':
      return { ...s, images: [...s.images, ...a.images].slice(0, 3) };
    case 'images/remove':
      return { ...s, images: s.images.filter((i) => i.id !== a.id) };
    case 'extract/done':
      return {
        ...s, step: 2, machine: a.machine, findings: [], decisions: [], result: null, aiUnavailable: false,
        tokensUsed: s.tokensUsed + a.usage.totalTokens,
      };
    case 'demo/loaded':
      return {
        ...s,
        step: 3,
        input: { ...s.input, flowName: s.input.flowName || a.machine.name },
        machine: a.machine,
        findings: mergeFindings(runChecks(a.machine), a.aiFindings),
        decisions: [],
        result: null,
        aiUnavailable: false,
      };
    case 'analyze/done':
      return {
        ...s, step: 3, findings: a.findings, decisions: keepDecisions(s.decisions, a.findings), result: null,
        aiUnavailable: a.warnings.includes('AI_GAPS_UNAVAILABLE'),
        tokensUsed: s.tokensUsed + a.usage.totalTokens,
      };
    case 'finalize/done':
      return { ...s, step: 4, result: a.result, tokensUsed: s.tokensUsed + a.usage.totalTokens };
    case 'step/go':
      return { ...s, step: a.step };
    case 'decision/set':
      return { ...s, decisions: [...s.decisions.filter((d) => d.findingId !== a.decision.findingId), a.decision] };
    case 'decision/clear':
      return { ...s, decisions: s.decisions.filter((d) => d.findingId !== a.findingId) };
    case 'project/load':
      return { ...s, ...a.data, step: a.data.step as Step, images: [], aiUnavailable: false };
    case 'storage/restored':
      return a.data === null ? { ...s, restored: true } : { ...wizardReducer(s, { type: 'project/load', data: a.data }), restored: true };
    case 'reset':
      return { ...initialState(), tokensUsed: s.tokensUsed, restored: true };
    default:
      return s.machine === null ? s : { ...s, machine: editMachine(s.machine, a) };
  }
}

/** Findings with an option, custom or accepted answer. "Decide later" does not count. */
export function decidedCount(findings: Finding[], decisions: Decision[]): number {
  const ids = new Set(findings.map((f) => f.id));
  return decisions.filter((d) => ids.has(d.findingId) && d.answerType !== 'skip').length;
}

/** Something worth saving or replacing: a machine or any text (SPEC §10.5). */
export const hasContent = (s: Pick<WizardState, 'machine' | 'input'>) => s.machine !== null || s.input.text !== '';
export const canSave = (s: Pick<WizardState, 'machine' | 'input'>) =>
  s.machine !== null || s.input.flowName !== '' || s.input.text !== '';

// ---- localStorage (SPEC §10): key rc_project_v1, every access in try/catch. ----

export const STORAGE_KEY = 'rc_project_v1';
type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

/** The stored project, or null when missing, invalid or unreadable. Same checks as a project file. */
export function loadStoredProject(storage: StorageLike | null | undefined): ProjectData | null {
  try {
    const raw = storage?.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data: unknown = JSON.parse(raw);
    const envelope = JSON.stringify({ format: PROJECT_FILE_FORMAT, version: PROJECT_FILE_VERSION, savedAt: '', data });
    const parsed = parseProjectFile(envelope);
    return parsed.ok ? parsed.data : null;
  } catch {
    return null;
  }
}

export function saveStoredProject(storage: StorageLike | null | undefined, data: ProjectData): void {
  try {
    storage?.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Storage full or blocked: the app keeps working without it.
  }
}

export function clearStoredProject(storage: StorageLike | null | undefined): void {
  try {
    storage?.removeItem(STORAGE_KEY);
  } catch {
    // Ignore.
  }
}

/** `window.localStorage`, or null when the browser blocks it. */
export function browserStorage(): StorageLike | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}
