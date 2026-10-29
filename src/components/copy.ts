// Every user-facing string in one place. Strings marked SPEC are exact (SPEC §10, §10.4, §10.5);
// the rest fill gaps SPEC leaves and are logged in docs/DECISIONS.md.

export const STEP_TITLES = {
  1: 'Show us your plan',
  2: 'Does this match your plan?',
  3: 'What did we miss?',
  4: 'Your specification',
} as const; // SPEC

export const COPY = {
  productName: 'RealityCompiler',

  // Step 1 (SPEC)
  readPlan: 'Read my plan',
  tryDemo: 'Try the demo',
  privacyNote: "Free-tier note: what you submit is sent to Google's Gemini API. Do not upload private or client material.",
  storageHelp: 'Your work is saved in this browser. Use "Save project file" to keep a copy or move it to another device. Images are not included in the file.',
  flowName: 'Flow name',
  flowType: 'Flow type',
  planText: 'Describe your plan',
  images: 'Sketches or screenshots',
  dropzoneHint: 'Drop up to 3 images here, or choose files. JPEG, PNG or WEBP.',
  chooseFiles: 'Choose images',
  removeImage: (n: number) => `Remove image ${n}`,
  imageAlt: (n: number) => `Uploaded image ${n}`,
  imageTypeError: 'Only JPEG, PNG or WEBP images are allowed.',
  imageCountError: 'You can add up to 3 images.',

  // Step 2 (SPEC)
  showAsList: 'Show as list',
  statesTab: 'States',
  eventsTab: 'Events',
  transitionsTab: 'Transitions',
  structuralIssues: (n: number) => `${n} structural issues right now`,
  findGaps: 'Find gaps',
  checkThis: 'Check this',
  addTransition: 'Add transition',
  addState: 'Add state',
  addEvent: 'Add event',
  start: 'Start',
  endType: 'End type',
  waitsForOutside: 'Waits for outside',
  needsUserInput: 'Needs user input',
  from: 'From',
  event: 'Event',
  to: 'To',
  label: 'Label',
  kind: 'Kind',
  delete: 'Delete',
  deleteStateConfirm: 'Delete this state? Its transitions are deleted too.',
  deleteEventConfirm: 'Delete this event? Transitions that use it are deleted too.',
  diagramFailed: 'The diagram could not be drawn. Here is the list instead.',
  diagramLoading: 'Drawing the diagram…',
  diagramAlt: 'Flow diagram of the states and transitions',

  // Step 3 (SPEC)
  showMatrix: 'Show completeness table',
  writeOwnAnswer: 'Write my own answer',
  acceptAsIs: 'Accept as-is',
  decideLater: 'Decide later',
  checkedByCode: 'Checked by code',
  suggestedByAi: 'Suggested by AI',
  aiNote: 'AI suggestion, not verified by code',
  decided: (decided: number, total: number) => `${decided} of ${total} decided`,
  buildSpec: 'Build my spec',
  willStayOpen: (n: number) => (n === 1 ? '1 issue without an answer will stay open.' : `${n} issues without an answer will stay open.`),
  aiUnavailable: 'AI suggestions are not available right now. The checks by code are complete.',
  states: 'States',
  matrixColumns: ['Timeout', 'Failure', 'Cancel', 'Double-submit'],
  matrixState: 'State',
  handled: '✓ handled',
  missing: '✗ missing',
  notApplicable: '–',

  // Step 4 (SPEC)
  mapTab: 'Map',
  rulesTab: 'Rules',
  scenariosTab: 'Scenarios',
  openIssuesTab: 'Open issues',
  exportTab: 'Export',
  acceptedAsIs: 'Accepted as-is',
  resolvedByAnswer: 'Resolved by your answer (not machine-verified)',
  backToGaps: 'Back to gaps',
  startOver: 'Start over',
  startOverConfirm: 'Start over? Your current project in this browser will be cleared.',
  noRules: 'No decisions were made yet.',
  noIssues: 'No open issues.',
  fromDecisions: 'From decisions',
  perTransition: 'Per transition',
  noScenarios: 'None yet.',
  noFindings: 'No gaps found. You can build your spec now.',
  tokensUsed: (n: number) => `Tokens used this session: ${n}`, // SPEC

  // Export tab (file names are SPEC; button words fill gaps)
  download: 'Download',
  copy: 'Copy', // SPEC
  copied: 'Copied',
  copyFailed: 'Could not copy. Use Download instead.',
  downloadLabel: (name: string) => `Download ${name}`,
  copyLabel: (name: string) => `Copy ${name}`,

  // Loading (SPEC §10.2)
  loadingExtract: 'Reading your plan…',
  loadingAnalyze: 'Looking for gaps…',
  loadingFinalize: 'Writing your specification…',
  stillWorking: 'Still working. The free tier can be slow.',

  // Errors (SPEC §10.4)
  errors: {
    TOO_LARGE: 'That file is too large. Try a smaller image.',
    MODEL_OUTPUT_INVALID: 'The AI gave an answer we could not use. Please try again.',
    RATE_LIMITED: (sec: number) => `The free limit is reached for now. Try again in ${sec} seconds.`,
    MODEL_ERROR: 'The AI service had a problem. Please try again.',
    INTERNAL: 'Something went wrong on our side.',
    NETWORK: 'Could not reach the server.',
  },

  // Project file (SPEC §10.5)
  saveProject: 'Save project file',
  openProject: 'Open project file',
  projectDownloaded: 'Project file downloaded.',
  projectLoaded: 'Project loaded.',
  replaceConfirm: 'Replace your current project with the file?',
  parseErrors: {
    NOT_A_PROJECT: 'That file is not a RealityCompiler project.',
    TOO_NEW: 'This project file was made by a newer version of the app.',
    TOO_LARGE: 'That file is too large.',
    INVALID: 'That project file is damaged or incomplete.',
  },
  stepReduced: 'Some parts of the file were missing, so we opened an earlier step.',
  decisionsDropped: (n: number) => `${n} answers did not match any issue and were skipped.`,

  // Dialogs
  confirm: 'Yes, continue',
  cancel: 'Cancel',
  dismiss: 'Dismiss',
} as const;

/** Flow type select (SPEC §10.1 step 1). */
export const FLOW_TYPE_OPTIONS = [
  { value: 'auto', label: 'Auto-detect' },
  { value: 'payments', label: 'Payments' },
  { value: 'auth', label: 'Login' },
  { value: 'booking', label: 'Booking' },
  { value: 'order', label: 'Orders' },
  { value: 'generic', label: 'Other' },
] as const;

/** Event kinds in the words users use (design.md §7). */
export const EVENT_KIND_LABELS = {
  user_action: 'User action',
  system: 'System result',
  timeout: 'Timeout',
  failure: 'Failure',
  cancel: 'Cancel',
  duplicate: 'Repeated action',
} as const;

export const END_TYPE_LABELS = { none: 'None', success: 'Success', failure: 'Failure' } as const;
