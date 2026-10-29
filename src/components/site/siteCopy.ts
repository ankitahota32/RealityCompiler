// Text for the landing, About and Contact pages (owner request, DECISIONS.md 2026-10-29).
// The wizard's exact strings stay in ../copy.ts.

export const CONTACT_EMAIL = 'hello@example.com'; // TODO(owner): replace with the real contact address.
export const REPO_URL = 'https://github.com/ankitahota32/RealityCompiler';

export const NAV_LINKS = [
  { href: '/', label: 'Home' },
  { href: '/about', label: 'About us' },
  { href: '/contact', label: 'Contact us' },
] as const;

export const SITE = {
  getStarted: 'Get started',
  openMenu: 'Open menu',
  closeMenu: 'Close menu',

  heroBadge: 'New: plans checked by code, not guesswork',
  heroLead:
    'Show a sketch, a screenshot or a few lines of text. RealityCompiler maps your plan, checks every path with plain code, and hands you a spec your team can build from.',
  seeHow: 'See how it works',

  flowTitleStart: 'Our',
  flowTitleAccent: 'Working',
  flowTitleEnd: 'Flow',
  flow: [
    { title: 'Step 1', name: 'Show your plan', body: 'Upload a sketch photo or a screenshot, or type the flow in plain words. Up to three images.' },
    { title: 'Step 2', name: 'Fix the map', body: 'Gemma 4 turns it into screens and actions. You rename, add or remove anything it read wrong.' },
    { title: 'Step 3', name: 'Answer the gaps', body: 'Code checks every path for dead ends, missing timeouts and retries. You decide each one.' },
    { title: 'Step 4', name: 'Get your spec', body: 'Take home a specification, test scenarios and a diagram, built from your answers.' },
  ],

  challengesLabel: 'Common planning gaps',
  challenges: [
    { text: 'We drew the happy path and forgot what happens when the bank never replies.' },
    { text: 'Nobody decided what the user sees after the third failed payment.' },
    { text: 'Half the screens in our sketch cannot be reached from anywhere.' },
    { text: 'QA found the missing cancel button one week before launch.' },
  ],
  challengesAnswer: [
    'Every state is checked by code: dead ends, unreachable screens, missing timeouts and repeated actions.',
    'You decide each gap, then export a spec your team can trust.',
  ],

  faq: [
    {
      q: 'What can I show it?',
      a: 'A photo of a whiteboard or paper sketch, a screenshot of a design, or a few lines of text. You can add up to three images, and text alone works too.',
    },
    {
      q: 'What does "checked by code" mean?',
      a: 'The AI only proposes the map of your flow. Dead ends, unreachable screens and missing handlers are found by plain, deterministic code, so the same plan always gives the same results. Ideas from the AI are labelled "Suggested by AI" and never counted as verified.',
    },
    {
      q: 'Are my sketches stored?',
      a: 'No. Images stay in your browser tab while you work and are never saved, not even in the project file. Your map and answers are saved in this browser only.',
    },
    {
      q: 'Where does my plan go?',
      a: "What you submit is sent to Google's Gemini API to read it and suggest gaps. Do not upload private or client material.",
    },
    {
      q: 'What do I get at the end?',
      a: 'A written specification, test scenarios, a test skeleton and a diagram of your flow, plus a project file you can reopen later.',
    },
    {
      q: 'Do I need an account?',
      a: 'No. Open the app and start. Use "Save project file" to keep a copy or move your work to another device.',
    },
  ],

  footerLine: 'Find the gaps in your plan before you write the code.',
  footerProduct: 'Product',
  footerCompany: 'Company',
  footerHowItWorks: 'How it works',
  footerFaq: 'Questions',
  footerSource: 'Source code',
  footerNote: 'Built with Gemma 4. Structural checks run as plain code.',
} as const;

export const ABOUT = {
  badge: 'About us',
  lead: 'RealityCompiler started with a simple frustration: most bugs in a new product were already in the plan, long before anyone wrote code.',
  sections: [
    {
      title: 'Why we built it',
      body: 'Sketches and whiteboard photos show the happy path. The hard parts, like timeouts, failed payments, repeated taps and dead ends, are usually missing. Teams find them late, in QA or in production, when they cost the most to fix.',
    },
    {
      title: 'The model proposes, code verifies',
      body: 'Gemma 4 reads your sketch and drafts a map of screens and actions. Everything structural after that is checked by plain, deterministic code. The same plan always gives the same findings, and AI suggestions are always labelled as suggestions.',
    },
    {
      title: 'You stay in charge',
      body: 'You correct the map before anything is checked, and you decide what to do about every gap. The final spec is built from your answers, not from guesses.',
    },
  ],
  principlesTitle: 'What we promise',
  principles: [
    'Your sketches are never stored, not in the browser and not in project files.',
    'No account, no tracking scripts, no analytics.',
    'Your work is saved in your own browser, and you can download it at any time.',
  ],
} as const;

export const CONTACT = {
  badge: 'Contact us',
  lead: 'Questions, ideas or a plan that broke the checker? We would like to hear about it.',
  emailTitle: 'Email',
  emailBody: 'For questions, feedback and ideas.',
  issuesTitle: 'Report a problem',
  issuesBody: 'Found a bug or a wrong finding? Open an issue on GitHub with the steps to repeat it.',
  issuesLink: 'Open an issue',
  sourceTitle: 'Source code',
  sourceBody: 'RealityCompiler is open on GitHub. Read how the checks work or suggest a change.',
  sourceLink: 'View on GitHub',
  privacyNote: 'Please do not send private or client material by email or in issues.',
} as const;
