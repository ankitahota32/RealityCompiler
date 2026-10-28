// Checklist copied verbatim from SPEC §8. Only the owner extends packs.

export const order: string[] = [
  'Item goes out of stock after the order is placed.',
  'Partial shipment: part of the order ships, part does not.',
  'Address changed or cancellation requested after dispatch.',
  'Delivery fails or the parcel is returned: refund, redelivery, or both?',
  'The same order is created twice (double submit, retry).',
  'Customer disputes an order or claims it never arrived.',
];
