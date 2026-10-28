import { describe, expect, it } from 'vitest';
import { runChecks } from '@/core/checker';
import { emptyProjectData, parseProjectFile, projectFileName, serializeProject } from '@/core/project';
import { ProjectDataSchema, type ProjectData } from '@/core/types';
import { bnplExportData, bnplMachine } from './fixtures';

const SAVED_AT = '2026-10-27T10:30:00.000Z';

function fullProject(): ProjectData {
  const machine = bnplMachine();
  const r = bnplExportData();
  return {
    step: 4,
    input: { flowName: 'BNPL', flowType: 'payments', text: 'Buy Now Pay Later checkout.' },
    machine,
    findings: runChecks(machine),
    decisions: [
      { findingId: 'f_missing_handler_s_credit_check_timeout', answerType: 'option', answer: 'Show an error and let the user retry' },
      { findingId: 'f_dead_end_state_s_credit_declined', answerType: 'custom', answer: 'Back to the cart' },
    ],
    result: {
      machine: r.machine,
      rules: r.rules,
      scenarios: r.scenarios,
      assumptions: r.assumptions,
      remainingFindings: r.remainingFindings,
      resolvedFindingIds: r.resolvedFindingIds,
      acceptedFindingIds: r.acceptedFindingIds,
    },
  };
}

/** A serialized file with `edit` applied to its parsed JSON. */
function editedFile(edit: (file: Record<string, unknown> & { data: ProjectData }) => void): string {
  const file = JSON.parse(serializeProject(fullProject(), SAVED_AT));
  edit(file);
  return JSON.stringify(file);
}

describe('project file', () => {
  it('(1) survives a round trip', () => {
    const data = fullProject();
    const parsed = parseProjectFile(serializeProject(data, SAVED_AT));
    expect(parsed).toEqual({ ok: true, data, savedAt: SAVED_AT, warnings: [] });
  });

  it('(2) serializes deterministically, with fixed key order and a final newline', () => {
    const text = serializeProject(fullProject(), SAVED_AT);
    expect(serializeProject(fullProject(), SAVED_AT)).toBe(text);
    expect(text.startsWith('{\n  "format": "realitycompiler.project",\n  "version": 1,\n  "savedAt": "2026-10-27T10:30:00.000Z",\n  "data": {\n    "step": 4,')).toBe(true);
    expect(text.endsWith('}\n')).toBe(true);
  });

  it('(3) rejects text that is not a project', () => {
    for (const text of ['not json', '[]', 'null', '42', '{"format":"something.else","version":1}']) {
      expect(parseProjectFile(text)).toMatchObject({ ok: false, code: 'NOT_A_PROJECT' });
    }
  });

  it('(4) rejects a newer version', () => {
    expect(parseProjectFile(editedFile((f) => { f.version = 2; }))).toMatchObject({ ok: false, code: 'TOO_NEW' });
    expect(parseProjectFile(editedFile((f) => { f.version = '1'; }))).toMatchObject({ ok: false, code: 'INVALID' });
  });

  it('(5) rejects files over 1,000,000 bytes', () => {
    expect(parseProjectFile('x'.repeat(1_000_001))).toEqual({ ok: false, code: 'TOO_LARGE', details: [] });
    // Multi-byte characters count as bytes, not characters.
    expect(parseProjectFile('é'.repeat(500_001))).toMatchObject({ code: 'TOO_LARGE' });
  });

  it('(6) rejects a machine with a transition to an unknown state', () => {
    const text = editedFile((f) => { f.data.machine!.transitions[0]!.to = 's_missing'; });
    const parsed = parseProjectFile(text);
    expect(parsed).toMatchObject({ ok: false, code: 'INVALID' });
    expect(parsed.ok ? [] : parsed.details).toEqual(['machine: Transition t_proceed goes to unknown state s_missing']);
    // The result machine is checked too, and so is the schema.
    expect(parseProjectFile(editedFile((f) => { f.data.result!.machine.transitions[0]!.from = 's_missing'; })))
      .toMatchObject({ ok: false, code: 'INVALID' });
    expect(parseProjectFile(editedFile((f) => { f.data.step = 9; }))).toMatchObject({ ok: false, code: 'INVALID' });
  });

  it('(7) reduces the step when parts are missing', () => {
    const noResult = parseProjectFile(editedFile((f) => { f.data.result = null; }));
    expect(noResult).toMatchObject({ ok: true, data: { step: 3 }, warnings: ['STEP_REDUCED'] });

    const noMachine = parseProjectFile(editedFile((f) => { f.data.step = 2; f.data.machine = null; }));
    expect(noMachine).toMatchObject({ ok: true, data: { step: 1 }, warnings: ['STEP_REDUCED'] });
  });

  it('(8) drops decisions for unknown findings', () => {
    const parsed = parseProjectFile(editedFile((f) => {
      f.data.decisions.push({ findingId: 'f_unknown', answerType: 'option', answer: 'x' });
    }));
    expect(parsed).toMatchObject({ ok: true, warnings: ['DECISIONS_DROPPED:1'] });
    expect(parsed.ok && parsed.data.decisions.map((d) => d.findingId)).toEqual([
      'f_missing_handler_s_credit_check_timeout',
      'f_dead_end_state_s_credit_declined',
    ]);
  });

  it('(9) keeps strings containing <script> unchanged', () => {
    const data = fullProject();
    data.input.text = '<script>alert(1)</script>';
    data.machine!.states[0]!.label = '<img src=x onerror=alert(1)>';
    const parsed = parseProjectFile(serializeProject(data, SAVED_AT));
    expect(parsed.ok && parsed.data.input.text).toBe('<script>alert(1)</script>');
    expect(parsed.ok && parsed.data.machine?.states[0]?.label).toBe('<img src=x onerror=alert(1)>');
  });

  it('(10) builds file names', () => {
    expect(projectFileName('Buy Now, Pay Later!')).toBe('buy-now-pay-later.rcproject.json');
    expect(projectFileName('')).toBe('project.rcproject.json');
    expect(projectFileName('!!!')).toBe('project.rcproject.json');
    expect(projectFileName('a'.repeat(100))).toBe(`${'a'.repeat(40)}.rcproject.json`);
  });

  it('(11) emptyProjectData passes the schema', () => {
    expect(ProjectDataSchema.safeParse(emptyProjectData()).success).toBe(true);
    expect(emptyProjectData()).toEqual({
      step: 1,
      input: { flowName: '', flowType: 'auto', text: '' },
      machine: null,
      findings: [],
      decisions: [],
      result: null,
    });
  });
});
