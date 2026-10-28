import aiGaps from '../../../../fixtures/bnpl.ai-gaps.json';
import machineJson from '../../../../fixtures/bnpl.machine.json';
import { StateMachineSchema } from '@/core/types';
import { withApi } from '@/server/http';
import { proposalsToFindings } from '@/server/steps/analyze';

export const runtime = 'nodejs';
export const maxDuration = 60;

// GET /api/demo (SPEC §9.3): Appendix A machine plus Appendix C gaps. No model call; the client runs the checker.
export const GET = withApi(async () => {
  const machine = StateMachineSchema.parse(machineJson);
  return Response.json({ machine, aiFindings: proposalsToFindings({ gaps: aiGaps }, machine) });
});
