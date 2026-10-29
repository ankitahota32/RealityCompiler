import { describe, expect, it } from 'vitest';
import { runChecks } from '@/core/checker';
import { ProjectDataSchema, type Finding, type ProjectData } from '@/core/types';
import { validateMachine } from '@/core/validate';
import {
  STORAGE_KEY,
  canSave,
  decidedCount,
  hasContent,
  initialState,
  loadStoredProject,
  nextUserId,
  saveStoredProject,
  toProjectData,
  wizardReducer,
  type WizardAction,
  type WizardState,
} from '@/components/wizardState';
import { bnplMachine } from '../core/fixtures';

const zero = { totalTokens: 0 };
const withMachine = (): WizardState => wizardReducer(initialState(), { type: 'extract/done', machine: bnplMachine(), usage: { totalTokens: 100 } });
const apply = (s: WizardState, ...actions: WizardAction[]) => actions.reduce(wizardReducer, s);
const machineOf = (s: WizardState) => {
  if (!s.machine) throw new Error('no machine');
  return s.machine;
};

class MemoryStorage {
  data = new Map<string, string>();
  getItem(k: string) { return this.data.get(k) ?? null; }
  setItem(k: string, v: string) { this.data.set(k, v); }
  removeItem(k: string) { this.data.delete(k); }
}
const throwing = {
  getItem: () => { throw new Error('blocked'); },
  setItem: () => { throw new Error('blocked'); },
  removeItem: () => { throw new Error('blocked'); },
};

describe('wizard steps', () => {
  it('extract goes to step 2, clears old findings and counts tokens', () => {
    const s = withMachine();
    expect([s.step, s.findings, s.decisions, s.result, s.tokensUsed]).toEqual([2, [], [], null, 100]);
  });

  it('demo goes to step 3 with 9 checker + 3 AI findings and fills an empty flow name', () => {
    const ai: Finding[] = [1, 2, 3].map((n) => ({
      id: `f_ai_${n}`, source: 'ai', ruleId: 'AI_GAP', severity: 'low', category: 'usability',
      title: `AI ${n}`, description: '', stateIds: ['s_cart'], question: { text: 'Q?', options: ['A', 'B'] },
    }));
    const s = wizardReducer(initialState(), { type: 'demo/loaded', machine: bnplMachine(), aiFindings: ai });
    expect(s.step).toBe(3);
    expect(s.findings).toHaveLength(12);
    expect(s.input.flowName).toBe('Buy Now Pay Later checkout');
    const named = apply(initialState(), { type: 'input/set', input: { flowName: 'Mine' } }, { type: 'demo/loaded', machine: bnplMachine(), aiFindings: [] });
    expect(named.input.flowName).toBe('Mine');
  });

  it('analyze replaces findings and keeps only decisions whose finding still exists', () => {
    const findings = runChecks(bnplMachine());
    const s = apply(
      withMachine(),
      { type: 'analyze/done', findings, usage: zero, warnings: [] },
      { type: 'decision/set', decision: { findingId: findings[0]!.id, answerType: 'option', answer: 'x' } },
      { type: 'decision/set', decision: { findingId: findings[1]!.id, answerType: 'accepted', answer: '' } },
      { type: 'analyze/done', findings: findings.slice(1), usage: zero, warnings: ['AI_GAPS_UNAVAILABLE'] },
    );
    expect(s.decisions.map((d) => d.findingId)).toEqual([findings[1]!.id]);
    expect(s.aiUnavailable).toBe(true);
  });

  it('one decision per finding; decide later does not count as decided', () => {
    const findings = runChecks(bnplMachine());
    const [a, b, c] = findings.map((f) => f.id);
    const s = apply(
      wizardReducer(withMachine(), { type: 'analyze/done', findings, usage: zero, warnings: [] }),
      { type: 'decision/set', decision: { findingId: a!, answerType: 'option', answer: 'x' } },
      { type: 'decision/set', decision: { findingId: a!, answerType: 'custom', answer: 'mine' } },
      { type: 'decision/set', decision: { findingId: b!, answerType: 'skip', answer: '' } },
      { type: 'decision/set', decision: { findingId: c!, answerType: 'accepted', answer: '' } },
    );
    expect(s.decisions).toHaveLength(3);
    expect(s.decisions.find((d) => d.findingId === a)?.answerType).toBe('custom');
    expect(decidedCount(s.findings, s.decisions)).toBe(2);
    expect(decidedCount(s.findings, wizardReducer(s, { type: 'decision/clear', findingId: a! }).decisions)).toBe(1);
  });

  it('reset clears everything but the session token total', () => {
    const s = wizardReducer(withMachine(), { type: 'reset' });
    expect(toProjectData(s)).toEqual(toProjectData(initialState()));
    expect(s.tokensUsed).toBe(100);
  });
});

describe('machine edits (step 2)', () => {
  it('renames, ignoring empty labels and cutting to 60 characters', () => {
    const s = apply(withMachine(),
      { type: 'state/rename', id: 's_cart', label: '  Basket  ' },
      { type: 'state/rename', id: 's_checkout', label: '   ' },
      { type: 'event/rename', id: 'e_proceed', label: 'x'.repeat(70) });
    const m = machineOf(s);
    expect(m.states[0]?.label).toBe('Basket');
    expect(m.states[1]?.label).toBe('Checkout Review');
    expect(m.events[0]?.label).toHaveLength(60);
  });

  it('keeps one start state, and a start state is never an end', () => {
    const s = apply(withMachine(), { type: 'state/setStart', id: 's_order_placed', value: true });
    const m = machineOf(s);
    expect(m.states.filter((x) => x.initial).map((x) => x.id)).toEqual(['s_order_placed']);
    expect(m.states.find((x) => x.id === 's_order_placed')?.terminal).toBe('none');
    const ended = machineOf(wizardReducer(s, { type: 'state/setEnd', id: 's_order_placed', terminal: 'success' }));
    expect(ended.states.find((x) => x.id === 's_order_placed')?.initial).toBe(false);
    expect(validateMachine(ended).ok).toBe(true);
  });

  it('sets flags and end types', () => {
    const m = machineOf(apply(withMachine(),
      { type: 'state/setFlag', id: 's_cart', flag: 'userInput', value: true },
      { type: 'state/setEnd', id: 's_credit_declined', terminal: 'failure' },
      { type: 'event/setKind', id: 'e_cancel', kind: 'user_action' }));
    expect(m.states[0]?.userInput).toBe(true);
    expect(m.states.find((x) => x.id === 's_credit_declined')?.terminal).toBe('failure');
    expect(m.events.find((e) => e.id === 'e_cancel')?.kind).toBe('user_action');
  });

  it('deleting a state also deletes its transitions; deleting an event deletes transitions using it', () => {
    const noCheck = machineOf(wizardReducer(withMachine(), { type: 'state/delete', id: 's_credit_check' }));
    expect(noCheck.states.map((x) => x.id)).not.toContain('s_credit_check');
    expect(noCheck.transitions.map((t) => t.id)).toEqual(['t_proceed', 't_confirm', 't_cancel']);
    expect(validateMachine(noCheck).ok).toBe(true);

    const noCancel = machineOf(wizardReducer(withMachine(), { type: 'event/delete', id: 'e_cancel' }));
    expect(noCancel.transitions.map((t) => t.id)).not.toContain('t_cancel');
    expect(validateMachine(noCancel).ok).toBe(true);
  });

  it('adds states, events and transitions with s_user_<n> ids that never collide', () => {
    const s = apply(withMachine(),
      { type: 'state/add', label: 'Payment Failed' },
      { type: 'state/add', label: 'Help' },
      { type: 'state/delete', id: 's_user_1' },
      { type: 'state/add', label: 'Again' },
      { type: 'event/add', label: 'Bank error', kind: 'failure' },
      { type: 'transition/add', from: 's_credit_check', event: 'e_user_1', to: 's_user_2' },
      { type: 'transition/add', from: 's_nope', event: 'e_user_1', to: 's_user_2' },
      { type: 'state/add', label: '   ' });
    const m = machineOf(s);
    expect(m.states.slice(-2).map((x) => [x.id, x.label])).toEqual([['s_user_2', 'Help'], ['s_user_3', 'Again']]);
    expect(m.events.at(-1)).toMatchObject({ id: 'e_user_1', kind: 'failure', label: 'Bank error' });
    expect(m.transitions.at(-1)).toMatchObject({ id: 't_user_1', from: 's_credit_check', event: 'e_user_1', to: 's_user_2' });
    expect(m.transitions).toHaveLength(7);
    expect(validateMachine(m).ok).toBe(true);
    expect(nextUserId('s_', ['s_user_2', 's_user_9', 's_cart'])).toBe('s_user_10');
  });

  it('respects the 25-state cap', () => {
    let s = withMachine();
    for (let i = 0; i < 30; i++) s = wizardReducer(s, { type: 'state/add', label: `S${i}` });
    expect(machineOf(s).states).toHaveLength(25);
  });

  it('edits do nothing without a machine', () => {
    const s = initialState();
    expect(wizardReducer(s, { type: 'state/add', label: 'X' })).toBe(s);
  });
});

describe('project data and storage', () => {
  const blob = new Blob(['x'], { type: 'image/jpeg' });
  const withImages = () => apply(withMachine(), { type: 'images/add', images: [{ id: 'i1', blob, url: 'blob:1' }] });

  it('toProjectData never contains images or token totals, and passes the schema', () => {
    const data = toProjectData(withImages());
    expect(Object.keys(data).sort()).toEqual(['decisions', 'findings', 'input', 'machine', 'result', 'step']);
    expect(JSON.stringify(data)).not.toContain('blob:');
    expect(ProjectDataSchema.safeParse(data).success).toBe(true);
  });

  it('keeps at most 3 images in memory', () => {
    const imgs = [1, 2, 3, 4].map((n) => ({ id: `i${n}`, blob, url: `blob:${n}` }));
    expect(wizardReducer(initialState(), { type: 'images/add', images: imgs }).images).toHaveLength(3);
  });

  it('saves and restores through storage', () => {
    const storage = new MemoryStorage();
    const data = toProjectData(withImages());
    saveStoredProject(storage, data);
    expect(storage.getItem(STORAGE_KEY)).not.toContain('blob:');
    expect(loadStoredProject(storage)).toEqual(data);
    const restored = wizardReducer(initialState(), { type: 'storage/restored', data: loadStoredProject(storage) });
    expect([restored.restored, restored.step, restored.images]).toEqual([true, 2, []]);
  });

  it('discards missing, broken or invalid stored data silently', () => {
    const storage = new MemoryStorage();
    expect(loadStoredProject(storage)).toBeNull();
    storage.setItem(STORAGE_KEY, '{not json');
    expect(loadStoredProject(storage)).toBeNull();
    const bad: ProjectData = toProjectData(withMachine());
    bad.machine!.transitions[0]!.to = 's_missing';
    storage.setItem(STORAGE_KEY, JSON.stringify(bad));
    expect(loadStoredProject(storage)).toBeNull();
    storage.setItem(STORAGE_KEY, JSON.stringify({ step: 9 }));
    expect(loadStoredProject(storage)).toBeNull();
    expect(wizardReducer(initialState(), { type: 'storage/restored', data: null })).toMatchObject({ restored: true, step: 1 });
  });

  it('works when storage throws or is missing', () => {
    expect(loadStoredProject(throwing)).toBeNull();
    expect(() => saveStoredProject(throwing, toProjectData(initialState()))).not.toThrow();
    expect(loadStoredProject(null)).toBeNull();
  });

  it('applies the project-file repairs to stored data (step 4 without a result opens step 3)', () => {
    const storage = new MemoryStorage();
    storage.setItem(STORAGE_KEY, JSON.stringify({ ...toProjectData(withMachine()), step: 4 }));
    expect(loadStoredProject(storage)?.step).toBe(3);
  });

  it('save and replace rules follow SPEC §10.5', () => {
    const empty = initialState();
    expect([canSave(empty), hasContent(empty)]).toEqual([false, false]);
    const named = wizardReducer(empty, { type: 'input/set', input: { flowName: 'X' } });
    expect([canSave(named), hasContent(named)]).toEqual([true, false]);
    const typed = wizardReducer(empty, { type: 'input/set', input: { text: 'hello' } });
    expect([canSave(typed), hasContent(typed)]).toEqual([true, true]);
    expect(hasContent(withMachine())).toBe(true);
  });

  it('loading a project replaces the state and clears images', () => {
    const data = { ...toProjectData(withMachine()), step: 2 };
    const s = wizardReducer(withImages(), { type: 'project/load', data });
    expect(s.images).toEqual([]);
    expect(toProjectData(s)).toEqual(data);
  });
});
