// Checklist copied verbatim from SPEC §8. Only the owner extends packs.

export const booking: string[] = [
  'Two users book the same slot at the same time.',
  'A slot is held while the user pays: what happens when the hold expires mid-payment?',
  'Cancellation window and refund rules; cancelling after the window.',
  'No-show handling for the customer and for the provider.',
  'Rescheduling conflicts and double bookings after a reschedule.',
  'Time zones and daylight-saving changes.',
];
