// Checklist copied verbatim from SPEC §8. Only the owner extends packs.

export const auth: string[] = [
  'Wrong password repeated many times: lockout, delay, or CAPTCHA?',
  'Password reset link expired or used twice.',
  'One-time code (OTP) expired, resend limits, or brute-force guessing.',
  'Session expires while the user is in the middle of an action: is their work lost?',
  'The same account logs in on two devices at once.',
  'Error messages reveal whether an email or account exists.',
];
