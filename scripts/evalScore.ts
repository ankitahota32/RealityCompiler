import { z } from 'zod';
import { EVENT_KINDS, FLOW_TYPES, type Finding } from '../src/core/types';

// Pure scoring for `npm run eval` (SPEC §14.3). No network, so it is unit-tested.

const SeededGapSchema = z.object({
  id: z.string().min(1),
  description: z.string().min(1),
  matchChecks: z.array(z.object({ ruleId: z.string().min(1), requiredKind: z.enum(EVENT_KINDS).optional() })),
  matchKeywords: z.array(z.string().min(1)),
});

export const EvalCaseSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/, 'lowercase letters, digits and dashes'),
  name: z.string().min(1),
  flowType: z.union([z.enum(FLOW_TYPES), z.literal('auto')]),
  text: z.string().max(4000),
  imagePaths: z.array(z.string()).max(3),
  seededGaps: z.array(SeededGapSchema).min(1),
});

export type EvalCase = z.infer<typeof EvalCaseSchema>;
export type SeededGap = z.infer<typeof SeededGapSchema>;

export interface Score {
  found: string[]; // seeded gap ids
  missed: string[];
  recall: number; // 0..1
}

function score(gaps: SeededGap[], isFound: (g: SeededGap) => boolean): Score {
  const found = gaps.filter(isFound).map((g) => g.id);
  const missed = gaps.filter((g) => !found.includes(g.id)).map((g) => g.id);
  return { found, missed, recall: gaps.length === 0 ? 0 : found.length / gaps.length };
}

const hasKeyword = (haystack: string, keywords: string[]) => {
  const text = haystack.toLowerCase();
  return keywords.some((k) => text.includes(k.toLowerCase()));
};

/** A gap is FOUND if a finding matches a matchChecks entry (ruleId and, if given, requiredKind) or its title+description holds a keyword. */
export function scoreFindings(gaps: SeededGap[], findings: Finding[]): Score {
  return score(gaps, (g) =>
    findings.some(
      (f) =>
        g.matchChecks.some((c) => c.ruleId === f.ruleId && (c.requiredKind === undefined || c.requiredKind === f.requiredKind)) ||
        hasKeyword(`${f.title} ${f.description}`, g.matchKeywords),
    ),
  );
}

/** A pasted chatbot answer is scored with the keyword rule only. */
export function scoreBaseline(gaps: SeededGap[], text: string): Score {
  return score(gaps, (g) => hasKeyword(text, g.matchKeywords));
}

export const percent = (r: number) => `${Math.round(r * 100)}%`;
