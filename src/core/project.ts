import { validateMachine, formatZodIssues } from './validate';
import {
  PROJECT_FILE_FORMAT,
  PROJECT_FILE_VERSION,
  ProjectFileSchema,
  type ProjectData,
  type ProjectFile,
} from './types';

export const PROJECT_FILE_MAX_BYTES = 1_000_000;

export type ParseProjectResult =
  | { ok: true; data: ProjectData; savedAt: string; warnings: string[] }
  | { ok: false; code: 'NOT_A_PROJECT' | 'TOO_NEW' | 'TOO_LARGE' | 'INVALID'; details: string[] };

/** Deterministic project file text (SPEC §11.7). The caller passes the time so this stays pure. */
export function serializeProject(data: ProjectData, savedAtIso: string): string {
  const file: ProjectFile = {
    format: PROJECT_FILE_FORMAT,
    version: PROJECT_FILE_VERSION,
    savedAt: savedAtIso,
    data,
  };
  return JSON.stringify(file, null, 2) + '\n';
}

/** Parses an untrusted project file (SPEC §11.7). Never follows a field as a path, URL or command. */
export function parseProjectFile(text: string): ParseProjectResult {
  if (new TextEncoder().encode(text).length > PROJECT_FILE_MAX_BYTES) {
    return { ok: false, code: 'TOO_LARGE', details: [] };
  }

  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, code: 'NOT_A_PROJECT', details: ['Not valid JSON'] };
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return { ok: false, code: 'NOT_A_PROJECT', details: ['Not a JSON object'] };
  }
  const envelope = raw as Record<string, unknown>;
  if (envelope.format !== PROJECT_FILE_FORMAT) {
    return { ok: false, code: 'NOT_A_PROJECT', details: ['Unknown format'] };
  }
  if (typeof envelope.version === 'number' && envelope.version > PROJECT_FILE_VERSION) {
    return { ok: false, code: 'TOO_NEW', details: [] };
  }
  if (envelope.version !== PROJECT_FILE_VERSION) {
    return { ok: false, code: 'INVALID', details: ['Unsupported version'] };
  }

  const parsed = ProjectFileSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, code: 'INVALID', details: formatZodIssues(parsed.error) };
  const { data, savedAt } = parsed.data;

  const details: string[] = [];
  if (data.machine !== null) {
    const v = validateMachine(data.machine);
    if (!v.ok) details.push(...v.errors.map((e) => `machine: ${e}`));
  }
  if (data.result !== null) {
    const v = validateMachine(data.result.machine);
    if (!v.ok) details.push(...v.errors.map((e) => `result.machine: ${e}`));
  }
  if (details.length > 0) return { ok: false, code: 'INVALID', details };

  // Repairs that do not fail the load.
  const warnings: string[] = [];
  let step = data.step;
  if (step >= 2 && data.machine === null) step = 1;
  if (step === 4 && data.result === null) step = 3;
  if (step !== data.step) warnings.push('STEP_REDUCED');

  const findingIds = new Set(data.findings.map((f) => f.id));
  const decisions = data.decisions.filter((d) => findingIds.has(d.findingId));
  const dropped = data.decisions.length - decisions.length;
  if (dropped > 0) warnings.push(`DECISIONS_DROPPED:${dropped}`);

  return { ok: true, data: { ...data, step, decisions }, savedAt, warnings };
}

/** `Buy Now, Pay Later!` → `buy-now-pay-later.rcproject.json` (SPEC §11.7). */
export function projectFileName(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return `${slug === '' ? 'project' : slug}.rcproject.json`;
}

export function emptyProjectData(): ProjectData {
  return {
    step: 1,
    input: { flowName: '', flowType: 'auto', text: '' },
    machine: null,
    findings: [],
    decisions: [],
    result: null,
  };
}
