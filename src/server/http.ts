// HTTP helpers: fixed error shape (SPEC §9.4), IP limiter (§12.2), image checks (§13).

export type ErrorCode = 'VALIDATION' | 'TOO_LARGE' | 'MODEL_OUTPUT_INVALID' | 'RATE_LIMITED' | 'MODEL_ERROR' | 'INTERNAL';

const STATUS: Record<ErrorCode, number> = {
  VALIDATION: 400,
  TOO_LARGE: 413,
  MODEL_OUTPUT_INVALID: 422,
  RATE_LIMITED: 429,
  MODEL_ERROR: 502,
  INTERNAL: 500,
};

/** An error that maps to one of the fixed API error codes. */
export class AppError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly retryAfterSec?: number,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export interface ErrorBody {
  error: { code: ErrorCode; message: string; retryAfterSec?: number };
}

/** Turns any error into the fixed JSON shape. Unknown errors are logged and become INTERNAL; no stack traces leave. */
export function errorResponse(e: unknown): Response {
  if (e instanceof AppError) {
    const body: ErrorBody = {
      error: { code: e.code, message: e.message, ...(e.retryAfterSec === undefined ? {} : { retryAfterSec: e.retryAfterSec }) },
    };
    const headers = e.retryAfterSec === undefined ? undefined : { 'Retry-After': String(e.retryAfterSec) };
    return Response.json(body, { status: STATUS[e.code], headers });
  }
  console.error('[api] internal error:', e instanceof Error ? e.name : typeof e);
  const body: ErrorBody = { error: { code: 'INTERNAL', message: 'Internal error.' } };
  return Response.json(body, { status: 500 });
}

/** Client key for the limiter: first `x-forwarded-for` value, else "local". */
export function clientKey(req: Request): string {
  const first = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return first ? first : 'local';
}

/** In-memory fixed window (SPEC §12.2). */
export class FixedWindowLimiter {
  private windows = new Map<string, { start: number; count: number }>();

  constructor(
    private readonly limit = 20,
    private readonly windowMs = 60_000,
    private readonly now: () => number = Date.now,
  ) {}

  check(key: string): { ok: true } | { ok: false; retryAfterSec: number } {
    const t = this.now();
    const w = this.windows.get(key);
    if (w === undefined || t - w.start >= this.windowMs) {
      this.windows.set(key, { start: t, count: 1 });
      return { ok: true };
    }
    if (w.count >= this.limit) {
      return { ok: false, retryAfterSec: Math.max(1, Math.ceil((w.start + this.windowMs - t) / 1000)) };
    }
    w.count += 1;
    return { ok: true };
  }
}

const ipLimiter = new FixedWindowLimiter();

/** Wraps a route: IP limiter (unless disabled), then the handler; every error becomes the fixed shape. */
export function withApi(
  handler: (req: Request) => Promise<Response>,
  options: { rateLimit?: boolean; limiter?: FixedWindowLimiter } = {},
): (req: Request) => Promise<Response> {
  const limiter = options.limiter ?? ipLimiter;
  return async (req) => {
    try {
      if (options.rateLimit !== false) {
        const r = limiter.check(clientKey(req));
        if (!r.ok) throw new AppError('RATE_LIMITED', 'Too many requests. Try again shortly.', r.retryAfterSec);
      }
      return await handler(req);
    } catch (e) {
      return errorResponse(e);
    }
  };
}

export type ImageMime = 'image/jpeg' | 'image/png' | 'image/webp';

/** Image type from magic bytes only (SPEC §13.2); null for anything else. */
export function detectImageType(bytes: Uint8Array): ImageMime | null {
  const at = (i: number) => bytes[i];
  if (at(0) === 0xff && at(1) === 0xd8 && at(2) === 0xff) return 'image/jpeg';
  if (at(0) === 0x89 && at(1) === 0x50 && at(2) === 0x4e && at(3) === 0x47) return 'image/png';
  if (
    at(0) === 0x52 && at(1) === 0x49 && at(2) === 0x46 && at(3) === 0x46 &&
    at(8) === 0x57 && at(9) === 0x45 && at(10) === 0x42 && at(11) === 0x50
  ) return 'image/webp';
  return null;
}

/** Reads a JSON body or throws VALIDATION. */
export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    throw new AppError('VALIDATION', 'The request body must be JSON.');
  }
}
