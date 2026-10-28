import type { FlowType } from '../core/types';
import { auth } from './auth';
import { booking } from './booking';
import { generic } from './generic';
import { order } from './order';
import { payments } from './payments';

const PACKS: Record<FlowType, string[]> = { payments, auth, booking, order, generic };

/** Risk checklist for a flow type (SPEC §8). */
export function getPack(flowType: FlowType): string[] {
  return PACKS[flowType];
}
