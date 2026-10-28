import { z } from 'zod';

// Data contracts (SPEC §5, FIXED). Do not rename fields or change shapes.

export const FLOW_TYPES = ['payments', 'auth', 'booking', 'order', 'generic'] as const;
export const EVENT_KINDS = ['user_action', 'system', 'timeout', 'failure', 'cancel', 'duplicate'] as const;
export const SEVERITIES = ['high', 'medium', 'low'] as const;
export const CATEGORIES = [
  'structure', 'business_rule', 'money_risk', 'data_risk',
  'security_abuse', 'concurrency', 'external_timing', 'usability',
] as const;

const id = (prefix: 's_' | 'e_' | 't_') => z.string().regex(new RegExp(`^${prefix}[a-z0-9_]{1,38}$`));

export const StateSchema = z.object({
  id: id('s_'),
  label: z.string().min(1).max(60),
  initial: z.boolean(),
  terminal: z.enum(['none', 'success', 'failure']),
  awaitsExternal: z.boolean(),   // waits for something outside user's control (payment, bank, server, approval)
  userInput: z.boolean(),        // user fills or submits something here
  evidence: z.string().max(160), // where in the input this was seen
  confidence: z.number().min(0).max(1),
});

export const EventSchema = z.object({
  id: id('e_'),
  label: z.string().min(1).max(60),
  kind: z.enum(EVENT_KINDS),
  evidence: z.string().max(160),
  confidence: z.number().min(0).max(1),
});

export const TransitionSchema = z.object({
  id: id('t_'),
  from: id('s_'),
  event: id('e_'),
  to: id('s_'),
  evidence: z.string().max(160),
  confidence: z.number().min(0).max(1),
});

export const StateMachineSchema = z.object({
  name: z.string().min(1).max(80),
  flowType: z.enum(FLOW_TYPES),
  states: z.array(StateSchema).max(25),
  events: z.array(EventSchema).max(40),
  transitions: z.array(TransitionSchema).max(60),
});

export const QuestionSchema = z.object({
  text: z.string().min(1).max(200),
  options: z.array(z.string().min(1).max(80)).min(2).max(4),
});

export const FindingSchema = z.object({
  id: z.string(),
  source: z.enum(['checker', 'ai']),
  ruleId: z.string(),                 // checker rule id (§6) or 'AI_GAP'
  severity: z.enum(SEVERITIES),
  category: z.enum(CATEGORIES),
  title: z.string().max(120),
  description: z.string().max(400),
  stateIds: z.array(z.string()),      // may be empty for machine-level findings
  requiredKind: z.enum(EVENT_KINDS).optional(), // only for MISSING_HANDLER
  question: QuestionSchema,           // every finding has a question
});

export const DecisionSchema = z.object({
  findingId: z.string(),
  answerType: z.enum(['option', 'custom', 'accepted', 'skip']),
  answer: z.string().max(400),        // option text, custom text, or '' for accepted/skip
});

export const ScenarioSchema = z.object({
  id: z.string(),                     // 'sc_t_<transitionId>' for transition scenarios, 'sc_ai_<n>' for AI
  origin: z.enum(['transition', 'decision']),
  title: z.string().max(140),
  priority: z.enum(SEVERITIES),
  steps: z.array(z.object({
    keyword: z.enum(['Given', 'When', 'Then', 'And']),
    text: z.string().max(200),
  })).min(2).max(8),
  coversTransitionIds: z.array(z.string()),
  coversFindingIds: z.array(z.string()),
});

export const RuleSchema = z.object({
  id: z.string(),                     // 'r_<n>'
  text: z.string().max(300),
  findingIds: z.array(z.string()),
});

export const PatchSchema = z.object({
  states: z.array(StateSchema),
  events: z.array(EventSchema),
  transitions: z.array(TransitionSchema),
});

export const UsageSchema = z.object({
  promptTokens: z.number(), outputTokens: z.number(), totalTokens: z.number(),
});

export type FlowType = (typeof FLOW_TYPES)[number];
export type EventKind = (typeof EVENT_KINDS)[number];
export type Severity = (typeof SEVERITIES)[number];
export type Category = (typeof CATEGORIES)[number];
export type State = z.infer<typeof StateSchema>;
export type Event = z.infer<typeof EventSchema>;
export type Transition = z.infer<typeof TransitionSchema>;
export type StateMachine = z.infer<typeof StateMachineSchema>;
export type Question = z.infer<typeof QuestionSchema>;
export type Finding = z.infer<typeof FindingSchema>;
export type Decision = z.infer<typeof DecisionSchema>;
export type Scenario = z.infer<typeof ScenarioSchema>;
export type Rule = z.infer<typeof RuleSchema>;
export type Patch = z.infer<typeof PatchSchema>;
export type Usage = z.infer<typeof UsageSchema>;

// Project data (SPEC §5.3, FIXED).

export const PROJECT_FILE_FORMAT = 'realitycompiler.project' as const;
export const PROJECT_FILE_VERSION = 1 as const;

export const ProjectInputSchema = z.object({
  flowName: z.string().max(80),
  flowType: z.enum(['auto', ...FLOW_TYPES]),
  text: z.string().max(4000),
});

export const ProjectResultSchema = z.object({
  machine: StateMachineSchema,                    // the patched machine from /api/finalize
  rules: z.array(RuleSchema).max(100),
  scenarios: z.array(ScenarioSchema).max(300),
  assumptions: z.array(z.string()),
  remainingFindings: z.array(FindingSchema).max(100),
  resolvedFindingIds: z.array(z.string()).max(200),
  acceptedFindingIds: z.array(z.string()).max(200),
});                                               // matrix and usage are NOT stored; the matrix is recomputed with buildMatrix()

export const ProjectDataSchema = z.object({
  step: z.number().int().min(1).max(4),
  input: ProjectInputSchema,                      // text and settings only, NEVER images
  machine: StateMachineSchema.nullable(),         // null until extraction has run
  findings: z.array(FindingSchema).max(100),
  decisions: z.array(DecisionSchema).max(100),
  result: ProjectResultSchema.nullable(),         // null until finalization has run
});

export const ProjectFileSchema = z.object({
  format: z.literal(PROJECT_FILE_FORMAT),
  version: z.literal(PROJECT_FILE_VERSION),
  savedAt: z.string(),                            // ISO 8601 UTC
  data: ProjectDataSchema,
});

export type ProjectInput = z.infer<typeof ProjectInputSchema>;
export type ProjectResult = z.infer<typeof ProjectResultSchema>;
export type ProjectData = z.infer<typeof ProjectDataSchema>;
export type ProjectFile = z.infer<typeof ProjectFileSchema>;

// Checker rule ids in evaluation order (SPEC §6.2, FIXED). The order is also the sort order of §6.6.
export const CHECKER_RULES = [
  'NO_INITIAL',
  'MULTIPLE_INITIAL',
  'NO_SUCCESS_TERMINAL',
  'NO_FAILURE_TERMINAL',
  'UNREACHABLE_STATE',
  'DEAD_END_STATE',
  'NO_PATH_TO_TERMINAL',
  'TERMINAL_HAS_OUTGOING',
  'NONDETERMINISTIC',
  'MISSING_HANDLER',
] as const;
export type CheckerRule = (typeof CHECKER_RULES)[number];

// Not defined by SPEC; shapes chosen at M1 (docs/DECISIONS.md).

export const HANDLER_KINDS = ['timeout', 'failure', 'cancel', 'duplicate'] as const;
export type HandlerKind = (typeof HANDLER_KINDS)[number];
export type MatrixCell = 'handled' | 'missing' | 'na';

/** One row of the completeness matrix (SPEC §6.5). */
export type MatrixRow = { stateId: string; label: string } & Record<HandlerKind, MatrixCell>;

/** Input to every export (SPEC §11), plus `findings`: the Step 3 list, used to look up titles of resolved findings. */
export interface ExportData {
  machine: StateMachine;
  rules: Rule[];
  scenarios: Scenario[];
  assumptions: string[];
  remainingFindings: Finding[];
  resolvedFindingIds: string[];
  acceptedFindingIds: string[];
  decisions: Decision[];
  findings: Finding[];
  generatedAt: string;               // YYYY-MM-DD
}
