// Checklist copied verbatim from SPEC §8. Only the owner extends packs.

export const generic: string[] = [
  'Empty or zero-data states (no items, no results).',
  'The user is not allowed to do this action (permission denied).',
  'Network is lost in the middle of an action: is the work saved or lost?',
  'Two users edit or act on the same thing at once.',
  'The user presses Back or refreshes in the middle of the flow: is data lost?',
  'Spam or abuse: the same action repeated very fast.',
];
