// Checklist copied verbatim from SPEC §8. Only the owner extends packs.

export const payments: string[] = [
  'Payment result arrives late, after the user already cancelled or the order was marked failed: what happens to the order and the money?',
  'Money is deducted but the payment status is unknown or pending: how is it resolved, and when is the customer told?',
  'The user taps Pay twice or retries after an error: can they be charged twice?',
  'UPI or app-based payment: the user leaves to a payment app and never returns, or a collect request expires.',
  'The amount charged differs from the cart total (price change, coupon expired, tax or delivery fee changed).',
  'Refunds: full versus partial refund, a refund that fails or is delayed, and who is notified.',
  'Stock or price changes while the user is paying.',
  'Cash on delivery: order refused at the door or payment not collected.',
];
