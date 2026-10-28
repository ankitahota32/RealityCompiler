// Function declarations copied verbatim from SPEC §7.3 (plain JSON-schema objects, lowercase types).

const STATE_JSON = {
  type: 'object',
  properties: {
    id: { type: 'string', description: "snake_case id starting with 's_'" },
    label: { type: 'string' },
    initial: { type: 'boolean' },
    terminal: { type: 'string', enum: ['none', 'success', 'failure'] },
    awaitsExternal: { type: 'boolean' },
    userInput: { type: 'boolean' },
    evidence: { type: 'string' },
    confidence: { type: 'number' },
  },
  required: ['id', 'label', 'initial', 'terminal', 'awaitsExternal', 'userInput', 'evidence', 'confidence'],
};
const EVENT_JSON = {
  type: 'object',
  properties: {
    id: { type: 'string', description: "snake_case id starting with 'e_'" },
    label: { type: 'string' },
    kind: { type: 'string', enum: ['user_action', 'system', 'timeout', 'failure', 'cancel', 'duplicate'] },
    evidence: { type: 'string' },
    confidence: { type: 'number' },
  },
  required: ['id', 'label', 'kind', 'evidence', 'confidence'],
};
const TRANSITION_JSON = {
  type: 'object',
  properties: {
    id: { type: 'string', description: "snake_case id starting with 't_'" },
    from: { type: 'string' }, event: { type: 'string' }, to: { type: 'string' },
    evidence: { type: 'string' }, confidence: { type: 'number' },
  },
  required: ['id', 'from', 'event', 'to', 'evidence', 'confidence'],
};

export const submitStateMachine = {
  name: 'submit_state_machine',
  description: 'Submit the state machine extracted from the input.',
  parameters: {
    type: 'object',
    properties: {
      name: { type: 'string' },
      flowType: { type: 'string', enum: ['payments', 'auth', 'booking', 'order', 'generic'] },
      states: { type: 'array', items: STATE_JSON },
      events: { type: 'array', items: EVENT_JSON },
      transitions: { type: 'array', items: TRANSITION_JSON },
    },
    required: ['name', 'flowType', 'states', 'events', 'transitions'],
  },
};

export const submitGapProposals = {
  name: 'submit_gap_proposals',
  description: 'Submit additional gaps found in the state machine.',
  parameters: {
    type: 'object',
    properties: {
      gaps: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            description: { type: 'string' },
            severity: { type: 'string', enum: ['high', 'medium', 'low'] },
            category: { type: 'string', enum: ['business_rule', 'money_risk', 'data_risk', 'security_abuse', 'concurrency', 'external_timing', 'usability'] },
            stateIds: { type: 'array', items: { type: 'string' } },
            question: { type: 'string' },
            options: { type: 'array', items: { type: 'string' } },
          },
          required: ['title', 'description', 'severity', 'category', 'stateIds', 'question', 'options'],
        },
      },
    },
    required: ['gaps'],
  },
};

export const submitFinalization = {
  name: 'submit_finalization',
  description: 'Submit the patch, rules and scenarios that implement the decisions.',
  parameters: {
    type: 'object',
    properties: {
      patch: {
        type: 'object',
        properties: {
          states: { type: 'array', items: STATE_JSON },
          events: { type: 'array', items: EVENT_JSON },
          transitions: { type: 'array', items: TRANSITION_JSON },
        },
        required: ['states', 'events', 'transitions'],
      },
      rules: {
        type: 'array',
        items: {
          type: 'object',
          properties: { text: { type: 'string' }, findingIds: { type: 'array', items: { type: 'string' } } },
          required: ['text', 'findingIds'],
        },
      },
      scenarios: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            priority: { type: 'string', enum: ['high', 'medium', 'low'] },
            steps: {
              type: 'array',
              items: {
                type: 'object',
                properties: { keyword: { type: 'string', enum: ['Given', 'When', 'Then', 'And'] }, text: { type: 'string' } },
                required: ['keyword', 'text'],
              },
            },
            findingIds: { type: 'array', items: { type: 'string' } },
          },
          required: ['title', 'priority', 'steps', 'findingIds'],
        },
      },
      assumptions: { type: 'array', items: { type: 'string' } },
    },
    required: ['patch', 'rules', 'scenarios', 'assumptions'],
  },
};
