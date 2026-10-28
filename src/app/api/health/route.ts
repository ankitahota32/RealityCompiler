import { getEnv } from '@/server/env';
import { withApi } from '@/server/http';

export const runtime = 'nodejs';
export const maxDuration = 60;

// GET /api/health (SPEC §9.3). Not rate limited; works without the key and never includes it.
export const GET = withApi(async () => {
  const env = getEnv();
  return Response.json({ ok: true, mock: env.mock, models: env.models });
}, { rateLimit: false });
