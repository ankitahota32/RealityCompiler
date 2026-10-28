import { describe, expect, it, vi } from 'vitest';
import { runChecks } from '@/core/checker';
import type { Decision, Finding, StateMachine } from '@/core/types';
import type { GemmaCallOptions, GemmaClient } from '@/server/gemma/client';
import { createMockClient } from '@/server/gemma/mock';
import { AppError } from '@/server/http';
import { proposalsToFindings, runAnalyze } from '@/server/steps/analyze';
import { runExtract } from '@/server/steps/extract';
import { runFinalize } from '@/server/steps/finalize';
import { bnplMachine, bnplPatch } from '../core/fixtures';

const mock = createMockClient(0);
const deps = (client: GemmaClient = mock) => ({ client, model: 'test-model' });
const usage = { promptTokens: 10, outputTokens: 5, totalTokens: 15 };

/** A client that answers each call with the next item, and records what it was asked. */
function scripted(answers: (unknown | Error)[]) {
  const calls: GemmaCallOptions[] = [];
  const client: GemmaClient = {
    async call(o) {
      calls.push(o);
      const next = answers[calls.length - 1];
      if (next instanceof Error) throw next;
      return { args: next, usage };
    },
  };
  return { client, calls };
}

const textInput = { flowName: 'BNPL', flowType: 'auto' as const, text: 'Buy now pay later checkout flow.', images: [] };

describe('extract → analyze → finalize with the mock client', () => {
  it('runs end to end; 7 checker findings remain (Appendix E.3)', async () => {
    const extracted = await runExtract(textInput, deps());
    expect(extracted.machine).toEqual(bnplMachine());
    expect(extracted.warnings).toEqual(['LOW_CONFIDENCE:1']);
    expect(extracted.usage).toEqual({ promptTokens: 0, outputTokens: 0, totalTokens: 0 });

    const analyzed = await runAnalyze(extracted.machine, deps());
    expect(analyzed.warnings).toEqual([]);
    expect(analyzed.findings).toHaveLength(12);
    expect(analyzed.findings.filter((f) => f.source === 'ai').map((f) => f.id)).toEqual(['f_ai_1', 'f_ai_2', 'f_ai_3']);
    expect(analyzed.matrix).toHaveLength(5);

    const decisions: Decision[] = [
      { findingId: 'f_missing_handler_s_credit_check_timeout', answerType: 'option', answer: 'Show an error and let the user retry' },
      { findingId: 'f_ai_1', answerType: 'custom', answer: 'Expire the approval' },
      { findingId: 'f_no_failure_terminal_machine', answerType: 'accepted', answer: '' },
      { findingId: 'f_ai_3', answerType: 'skip', answer: '' },
    ];
    const result = await runFinalize({ machine: extracted.machine, findings: analyzed.findings, decisions }, deps());

    const checkerLeft = result.remainingFindings.filter((f) => f.source === 'checker').map((f) => f.id);
    expect(checkerLeft).toEqual([
      'f_missing_handler_s_credit_check_failure',
      'f_no_failure_terminal_machine',
      'f_unreachable_state_s_referral',
      'f_missing_handler_s_checkout_cancel',
      'f_missing_handler_s_checkout_duplicate',
      'f_missing_handler_s_credit_check_cancel',
      'f_missing_handler_s_confirm_duplicate',
    ]);
    // AI findings without an option/custom answer stay open; f_ai_1 was answered.
    expect(result.remainingFindings.filter((f) => f.source === 'ai').map((f) => f.id)).toEqual(['f_ai_2', 'f_ai_3']);
    expect(result.resolvedFindingIds).toEqual(['f_dead_end_state_s_credit_declined', 'f_missing_handler_s_credit_check_timeout', 'f_ai_1']);
    expect(result.acceptedFindingIds).toEqual(['f_no_failure_terminal_machine']);
    expect(result.rules.map((r) => r.id)).toEqual(['r_1', 'r_2']);
    expect(result.scenarios.map((s) => s.id)).toEqual([
      'sc_ai_1', 'sc_ai_2',
      ...result.machine.transitions.map((t) => `sc_t_${t.id}`),
    ]);
    expect(result.scenarios[0]?.coversFindingIds).toEqual(['f_missing_handler_s_credit_check_timeout']);
    expect(result.assumptions).toEqual(['Retry has no maximum count yet.']);
    expect(result.warnings).toEqual([]);
    expect(result.machine.states).toHaveLength(8);
  });

  it('remaining findings are exactly the 7 of Appendix E.3 when every AI finding is answered', async () => {
    const machine = bnplMachine();
    const { findings } = await runAnalyze(machine, deps());
    const decisions: Decision[] = ['f_missing_handler_s_credit_check_timeout', 'f_ai_1', 'f_ai_2', 'f_ai_3']
      .map((findingId) => ({ findingId, answerType: 'option', answer: 'x' }));
    const result = await runFinalize({ machine, findings, decisions }, deps());
    expect(result.remainingFindings).toHaveLength(7);
  });
});

describe('runExtract', () => {
  it('overrides flowType when the user chose one', async () => {
    const r = await runExtract({ ...textInput, flowType: 'order' }, deps());
    expect(r.machine.flowType).toBe('order');
  });

  it('builds the SPEC user text and passes images through', async () => {
    const { client, calls } = scripted([bnplMachine()]);
    const image = { bytes: new Uint8Array([0xff, 0xd8, 0xff]), mimeType: 'image/jpeg' as const };
    await runExtract({ flowName: 'BNPL', flowType: 'auto', text: '', images: [image] }, deps(client));
    expect(calls[0]?.userText).toBe('FLOW NAME: BNPL\nFLOW TYPE HINT: none\nUSER TEXT:\n(none)');
    expect(calls[0]).toMatchObject({ step: 'extract', thinking: 'minimal', maxOutputTokens: 3500, images: [image] });
  });

  it('re-asks once with the errors, then succeeds and sums usage', async () => {
    const bad = { ...bnplMachine(), transitions: [{ ...bnplMachine().transitions[0]!, to: 's_nowhere' }] };
    const { client, calls } = scripted([bad, bnplMachine()]);
    const r = await runExtract(textInput, deps(client));
    expect(calls).toHaveLength(2);
    expect(calls[1]?.userText).toContain('YOUR PREVIOUS CALL WAS INVALID: Transition t_proceed goes to unknown state s_nowhere.');
    expect(calls[1]?.userText).toContain('Call submit_state_machine again with these problems fixed.');
    expect(r.usage).toEqual({ promptTokens: 20, outputTokens: 10, totalTokens: 30 });
  });

  it('gives MODEL_OUTPUT_INVALID after two invalid answers', async () => {
    const { client } = scripted([{ nope: true }, { still: 'bad' }]);
    await expect(runExtract(textInput, deps(client))).rejects.toMatchObject({ code: 'MODEL_OUTPUT_INVALID' });
  });
});

describe('runAnalyze', () => {
  it('sends the machine, up to 12 checker titles and the flow-type checklist', async () => {
    const { client, calls } = scripted([{ gaps: [] }]);
    await runAnalyze(bnplMachine(), deps(client));
    const text = calls[0]?.userText ?? '';
    expect(text.startsWith('MACHINE: {"states":[{"id":"s_cart","label":"Cart","initial":true,')).toBe(true);
    expect(text).not.toContain('evidence');
    expect(text).toContain('\nALREADY FOUND (do not repeat): ["\\"Credit Declined\\" is a dead end",');
    expect(text).toContain('\nCHECKLIST FOR payments:\n1. Payment result arrives late');
    expect(calls[0]).toMatchObject({ step: 'analyze', thinking: 'high', maxOutputTokens: 8000 });
  });

  it('keeps the checker findings and warns when the model call fails', async () => {
    const { client } = scripted([new AppError('MODEL_ERROR', 'down')]);
    const r = await runAnalyze(bnplMachine(), deps(client));
    expect(r.warnings).toEqual(['AI_GAPS_UNAVAILABLE']);
    expect(r.findings).toEqual(runChecks(bnplMachine()));
    expect(r.usage.totalTokens).toBe(0);
  });
});

describe('proposalsToFindings', () => {
  const machine: StateMachine = bnplMachine();
  const gap = (over: Record<string, unknown> = {}) => ({
    title: 'T', description: 'D', severity: 'high', category: 'money_risk', stateIds: ['s_cart'],
    question: 'Q?', options: ['A', 'B'], ...over,
  });

  it('converts valid gaps into AI findings', () => {
    expect(proposalsToFindings({ gaps: [gap()] }, machine)).toEqual([{
      id: 'f_ai_1', source: 'ai', ruleId: 'AI_GAP', severity: 'high', category: 'money_risk',
      title: 'T', description: 'D', stateIds: ['s_cart'], question: { text: 'Q?', options: ['A', 'B'] },
    }]);
  });

  it('drops gaps with missing text, bad options or no known state, and numbers the rest in order', () => {
    const out = proposalsToFindings({
      gaps: [
        gap({ title: '' }),
        gap({ question: undefined }),
        gap({ options: ['only one'] }),
        gap({ options: ['a', 'b', 'c', 'd', 'e'] }),
        gap({ options: ['a', 3] }),
        gap({ stateIds: ['s_made_up'] }),
        gap({ title: 'kept', stateIds: ['s_made_up', 's_confirm', 's_confirm'] }),
        'not an object',
      ],
    }, machine);
    expect(out.map((f) => [f.id, f.title, f.stateIds])).toEqual([['f_ai_1', 'kept', ['s_confirm']]]);
  });

  it('cuts strings to the schema limits, defaults bad severity/category, keeps at most 8', () => {
    const long = proposalsToFindings({
      gaps: [gap({ title: 'x'.repeat(200), description: 'y'.repeat(500), question: 'z'.repeat(300), options: ['o'.repeat(90), 'B'], severity: 'urgent', category: 'structure' })],
    }, machine)[0] as Finding;
    expect([long.title.length, long.description.length, long.question.text.length, long.question.options[0]?.length]).toEqual([120, 400, 200, 80]);
    expect([long.severity, long.category]).toEqual(['medium', 'business_rule']);
    expect(proposalsToFindings({ gaps: Array.from({ length: 12 }, () => gap()) }, machine)).toHaveLength(8);
  });

  it('returns nothing for args without a gap list', () => {
    expect(proposalsToFindings(undefined, machine)).toEqual([]);
    expect(proposalsToFindings({ gaps: 'none' }, machine)).toEqual([]);
  });
});

describe('runFinalize', () => {
  const machine = bnplMachine();
  const findings = runChecks(machine);

  it('skips the model when there is nothing actionable', async () => {
    const client: GemmaClient = { call: vi.fn() };
    const decisions: Decision[] = [
      { findingId: 'f_no_failure_terminal_machine', answerType: 'accepted', answer: '' },
      { findingId: 'f_unknown', answerType: 'option', answer: 'ignored: unknown finding' },
    ];
    const r = await runFinalize({ machine, findings, decisions }, deps(client));
    expect(client.call).not.toHaveBeenCalled();
    expect(r.machine).toEqual(machine);
    expect(r.rules).toEqual([]);
    expect(r.scenarios.every((s) => s.origin === 'transition')).toBe(true);
    expect(r.remainingFindings).toEqual(findings);
    expect(r.acceptedFindingIds).toEqual(['f_no_failure_terminal_machine']);
    expect(r.usage.totalTokens).toBe(0);
  });

  it('sends only actionable decisions with their finding context', async () => {
    const { client, calls } = scripted([{ patch: { states: [], events: [], transitions: [] }, rules: [], scenarios: [], assumptions: [] }]);
    await runFinalize({
      machine, findings,
      decisions: [
        { findingId: 'f_dead_end_state_s_credit_declined', answerType: 'custom', answer: 'Back to cart' },
        { findingId: 'f_unreachable_state_s_referral', answerType: 'skip', answer: '' },
      ],
    }, deps(client));
    expect(calls[0]?.userText).toContain('\nDECISIONS: [{"findingId":"f_dead_end_state_s_credit_declined","title":"\\"Credit Declined\\" is a dead end","stateIds":["s_credit_declined"],"question":"After \\"Credit Declined\\", where should the user go next?","answer":"Back to cart"}]');
    expect(calls[0]).toMatchObject({ step: 'finalize', thinking: 'minimal', maxOutputTokens: 3500 });
  });

  it('re-asks once when the patch is invalid, then fails with MODEL_OUTPUT_INVALID', async () => {
    const decisions: Decision[] = [{ findingId: 'f_dead_end_state_s_credit_declined', answerType: 'option', answer: 'Back to Cart' }];
    const badPatch = { patch: { states: [{ id: 'BAD' }], events: [], transitions: [] }, rules: [], scenarios: [], assumptions: [] };
    const { client, calls } = scripted([badPatch, badPatch]);
    await expect(runFinalize({ machine, findings, decisions }, deps(client))).rejects.toMatchObject({ code: 'MODEL_OUTPUT_INVALID' });
    expect(calls).toHaveLength(2);
    expect(calls[1]?.userText).toContain('YOUR PREVIOUS PATCH WAS INVALID: patch.states.0.id');
  });

  it('keeps patch warnings and drops malformed rules and scenarios', async () => {
    const decisions: Decision[] = [{ findingId: 'f_missing_handler_s_credit_check_timeout', answerType: 'option', answer: 'Retry' }];
    const patch = bnplPatch();
    patch.states.push({ ...machine.states[0]!, initial: true }); // duplicate id s_cart
    const { client } = scripted([{
      patch,
      rules: [{ text: 'Good rule', findingIds: ['f_missing_handler_s_credit_check_timeout', 'f_made_up'] }, { text: '' }, 'junk'],
      scenarios: [
        { title: 'Good', priority: 'urgent', steps: [{ keyword: 'Given', text: 'a' }, { keyword: 'Then', text: 'b' }, { keyword: 'Maybe', text: 'c' }], findingIds: [] },
        { title: 'One step only', priority: 'low', steps: [{ keyword: 'Given', text: 'a' }], findingIds: [] },
      ],
      assumptions: ['A', 3],
    }]);
    const r = await runFinalize({ machine, findings, decisions }, deps(client));
    expect(r.warnings).toEqual(['PATCH_DUPLICATE_ID:s_cart']);
    expect(r.rules).toEqual([{ id: 'r_1', text: 'Good rule', findingIds: ['f_missing_handler_s_credit_check_timeout'] }]);
    const decisionScenarios = r.scenarios.filter((s) => s.origin === 'decision');
    expect(decisionScenarios.map((s) => [s.id, s.priority, s.steps.length])).toEqual([['sc_ai_1', 'medium', 2]]);
    expect(r.assumptions).toEqual(['A']);
  });
});
