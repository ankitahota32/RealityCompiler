// "How to use these files" guide for the Export tab (owner request, DECISIONS.md 2026-10-31).
// Fixed text plus a summary computed from the user's own result. No model call.

import type { ExportData } from '@/core/types';

/** A guide paragraph: plain text, or text with one inline command or path shown as code. */
export type GuideLine = string | { text: string; code: string };

export interface FileGuide {
  file: string;
  what: string;
  who: string;
  where: GuideLine[];
  how: GuideLine[];
}

export const GUIDE_COPY = {
  button: 'How to use these files',
  title: 'How to use your files',
  intro: 'Each file serves a different person on your team. Here is what to do with each one, where to put it and how to start.',
  startTab: 'Start here',
  yourResult: 'Your result',
  order: 'Recommended order',
  what: 'What it is',
  who: 'Who uses it',
  where: 'Where to put it',
  how: 'How to use it',
  close: 'Close',
} as const;

export const GUIDE_ORDER: string[] = [
  'Read spec.md with your team and decide the open issues before anyone builds.',
  'Give scenarios.feature to QA as acceptance criteria, or add it to your test suite.',
  'When the screens exist, turn playwright-skeleton.spec.ts into real end-to-end tests.',
  'Commit machine.json and findings.json next to the spec so later changes can be compared.',
  'To continue this work in RealityCompiler later, use "Save project file". The exports cannot be opened again in the app.',
];

export const FILE_GUIDES: FileGuide[] = [
  {
    file: 'spec.md',
    what: 'The written specification: a summary, the flow diagram, every state and transition, the rules from your answers, the test scenarios and the issues still open.',
    who: 'Everyone: product managers, designers, developers and QA.',
    where: [
      { text: 'In your code repository, for example', code: 'docs/spec/checkout.md' },
      'Or paste it into Notion, Confluence or Google Docs, or attach it to the ticket for this feature.',
    ],
    how: [
      'Open it in any Markdown viewer. GitHub and GitLab draw the diagram automatically from the mermaid block.',
      { text: 'Elsewhere, copy the mermaid block into', code: 'https://mermaid.live' },
      'Go through section 8, "Open and accepted issues", with your team and decide each one before building.',
    ],
  },
  {
    file: 'scenarios.feature',
    what: 'Test scenarios in Gherkin (Given / When / Then): one for each decision you made and one for each transition in the flow. Tags show the priority.',
    who: 'QA and developers. Product managers can read it as acceptance criteria.',
    where: [
      { text: 'In the features folder of a Cucumber, SpecFlow or Behave project, for example', code: 'features/checkout.feature' },
      'Or copy the scenarios into Jira, Linear or TestRail as manual test cases.',
    ],
    how: [
      { text: 'For JavaScript projects, install Cucumber:', code: 'npm install --save-dev @cucumber/cucumber' },
      { text: 'Put the file in features/ and run', code: 'npx cucumber-js' },
      'Cucumber lists every step that has no code yet. Write those step definitions against your real app.',
      'Without automation, use each scenario as a manual checklist: set up the Given, do the When, check the Then.',
    ],
  },
  {
    file: 'playwright-skeleton.spec.ts',
    what: 'A starter Playwright test file with one test per scenario. Each step is a TODO, because the app does not exist yet and there are no real buttons or selectors to point at.',
    who: 'Developers or QA automation engineers, once the screens are built.',
    where: [{ text: 'In the end-to-end tests folder of your web app, for example', code: 'tests/checkout.spec.ts' }],
    how: [
      { text: 'If the app has no Playwright yet, set it up:', code: 'npm init playwright@latest' },
      'Copy the file into the tests folder. Inside each test.step, replace the TODO with real actions, such as page.goto(...) and page.getByRole("button", { name: "Submit" }).click().',
      'When a test is filled in, change test.fixme to test so it runs.',
      { text: 'Run the tests with', code: 'npx playwright test' },
    ],
  },
  {
    file: 'machine.json',
    what: 'The final flow as data: every state (screen or wait), every event (action or result) and every transition (from a state, on an event, to a state).',
    who: 'Developers building the flow, and anyone writing tools or reviews on top of it.',
    where: [{ text: 'Next to the spec in your repository, for example', code: 'docs/spec/checkout.machine.json' }],
    how: [
      'Use it as the checklist for the build: each state needs a screen or a waiting state, and each transition needs code that handles that event.',
      'If your app uses a state machine library such as XState, write its configuration from these states and transitions.',
      'Keep it in version control. When the plan changes, run RealityCompiler again and compare the two files to see what moved.',
    ],
  },
  {
    file: 'findings.json',
    what: 'The record of the gaps: the ones still open ("remaining"), the ones resolved or accepted as-is, and every answer you gave.',
    who: 'Product managers and tech leads tracking decisions.',
    where: [
      { text: 'Next to the spec, for example', code: 'docs/spec/checkout.findings.json' },
      'Or turn each open item into a ticket in your tracker.',
    ],
    how: [
      'Create one ticket for each item in "remaining" and give it an owner.',
      'Keep "decisions" as the record of why the flow works the way it does.',
      'This file cannot be loaded back into the app. To continue later, use "Save project file".',
    ],
  },
];

/** Plain-language summary of this result, shown at the top of the guide. */
export function guideSummary(data: Pick<ExportData, 'machine' | 'rules' | 'scenarios' | 'remainingFindings' | 'acceptedFindingIds'>): string[] {
  const accepted = new Set(data.acceptedFindingIds);
  const open = data.remainingFindings.filter((f) => !accepted.has(f.id));
  const high = open.filter((f) => f.severity === 'high').length;
  const n = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;
  const lines = [
    `"${data.machine.name}" has ${n(data.machine.states.length, 'state', 'states')} and ${n(data.machine.transitions.length, 'transition', 'transitions')}, ${n(data.rules.length, 'rule', 'rules')} from your answers and ${n(data.scenarios.length, 'test scenario', 'test scenarios')}.`,
  ];
  if (open.length === 0) {
    lines.push('No issues are left open, so the spec is ready to share and build from.');
  } else {
    const highText = high > 0 ? `, ${high} of them HIGH` : '';
    lines.push(`${n(open.length, 'issue is', 'issues are')} still open${highText}. Decide ${open.length === 1 ? 'it' : 'them'} with your team before building; they are listed in spec.md, section 8 "Open and accepted issues".`);
  }
  return lines;
}
