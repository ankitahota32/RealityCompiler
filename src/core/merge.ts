import { CHECKER_RULES, type Finding, type Severity } from './types';

const SEVERITY_RANK: Record<Severity, number> = { high: 0, medium: 1, low: 2 };

function ruleRank(ruleId: string): number {
  const i = (CHECKER_RULES as readonly string[]).indexOf(ruleId);
  return i === -1 ? CHECKER_RULES.length : i;
}

/**
 * One list sorted per SPEC §6.6: severity, then source (checker before ai), then rule order.
 * The sort is stable, so state and kind order come from runChecks (which emits in that order)
 * and AI findings keep their returned order.
 */
export function mergeFindings(checker: Finding[], ai: Finding[]): Finding[] {
  return [...checker, ...ai].sort(
    (a, b) =>
      SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] ||
      (a.source === b.source ? 0 : a.source === 'checker' ? -1 : 1) ||
      ruleRank(a.ruleId) - ruleRank(b.ruleId),
  );
}
