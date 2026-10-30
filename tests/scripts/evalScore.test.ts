import { describe, expect, it } from 'vitest';
import caseJson from '../../evals/cases/bnpl-checkout.json';
import { runChecks } from '@/core/checker';
import type { Finding } from '@/core/types';
import { EvalCaseSchema, percent, scoreBaseline, scoreFindings } from '../../scripts/evalScore';
import { bnplMachine } from '../core/fixtures';

const evalCase = EvalCaseSchema.parse(caseJson);

const aiFinding = (title: string, description = ''): Finding => ({
  id: 'f_ai_1',
  source: 'ai',
  ruleId: 'AI_GAP',
  severity: 'medium',
  category: 'business_rule',
  title,
  description,
  stateIds: [],
  question: { text: 'What should happen?', options: ['A', 'B'] },
});

describe('eval case file', () => {
  it('the shipped Appendix F case parses', () => {
    expect(evalCase.id).toBe('bnpl-checkout');
    expect(evalCase.seededGaps.map((g) => g.id)).toEqual(['g1', 'g2', 'g3', 'g4']);
  });

  it('rejects a case without seeded gaps or with a bad id', () => {
    expect(EvalCaseSchema.safeParse({ ...evalCase, seededGaps: [] }).success).toBe(false);
    expect(EvalCaseSchema.safeParse({ ...evalCase, id: 'Bad Id' }).success).toBe(false);
    expect(EvalCaseSchema.safeParse({ ...evalCase, imagePaths: ['a', 'b', 'c', 'd'] }).success).toBe(false);
  });
});

describe('scoreFindings', () => {
  it('matches checker findings by ruleId and requiredKind (Appendix A machine finds g1 to g3)', () => {
    const s = scoreFindings(evalCase.seededGaps, runChecks(bnplMachine()));
    expect(s.found).toEqual(['g1', 'g2', 'g3']);
    expect(s.missed).toEqual(['g4']);
    expect(percent(s.recall)).toBe('75%');
  });

  it('requiredKind must agree when the check names one', () => {
    const wrongKind: Finding = { ...aiFinding('x'), source: 'checker', ruleId: 'MISSING_HANDLER', requiredKind: 'cancel' };
    expect(scoreFindings(evalCase.seededGaps, [wrongKind]).found).toEqual([]);
  });

  it('matches keywords in title or description, ignoring case', () => {
    expect(scoreFindings(evalCase.seededGaps, [aiFinding('Bank approval arrives LATE')]).found).toEqual(['g4']);
    expect(scoreFindings(evalCase.seededGaps, [aiFinding('Order state', 'User may Abandon the flow')]).found).toEqual(['g4']);
  });

  it('nothing found gives 0 recall', () => {
    expect(scoreFindings(evalCase.seededGaps, [])).toEqual({ found: [], missed: ['g1', 'g2', 'g3', 'g4'], recall: 0 });
  });
});

describe('scoreBaseline', () => {
  it('uses keywords only', () => {
    const s = scoreBaseline(evalCase.seededGaps, 'You should handle a TIMEOUT from the bank and a user who taps twice.');
    expect(s.found).toEqual(['g1', 'g2']);
    expect(percent(s.recall)).toBe('50%');
  });
});
