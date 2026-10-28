import { FLOW_TYPES, type FlowType } from '@/core/types';
import { getEnv } from '@/server/env';
import { getGemmaClient, type GemmaCallOptions } from '@/server/gemma/client';
import { AppError, detectImageType, withApi } from '@/server/http';
import { runExtract } from '@/server/steps/extract';

export const runtime = 'nodejs';
export const maxDuration = 60;

const MAX_IMAGES = 3;
const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
const MAX_TOTAL_BYTES = 4 * 1024 * 1024;
const MAX_TEXT = 4000;
const MAX_FLOW_NAME = 80;

const field = (form: FormData, name: string) => {
  const v = form.get(name);
  return typeof v === 'string' ? v : '';
};

// POST /api/extract (SPEC §9.1): multipart form with images, text, flowName, flowType.
export const POST = withApi(async (req) => {
  const env = getEnv();
  const client = getGemmaClient(env);

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    throw new AppError('VALIDATION', 'Send the plan as a multipart form.');
  }

  const flowName = field(form, 'flowName').trim();
  if (flowName.length < 1 || flowName.length > MAX_FLOW_NAME) {
    throw new AppError('VALIDATION', `Flow name is required (1 to ${MAX_FLOW_NAME} characters).`);
  }
  const text = field(form, 'text');
  if (text.length > MAX_TEXT) throw new AppError('TOO_LARGE', `The description is too long (at most ${MAX_TEXT} characters).`);
  const flowTypeRaw = field(form, 'flowType') || 'auto';
  if (flowTypeRaw !== 'auto' && !(FLOW_TYPES as readonly string[]).includes(flowTypeRaw)) {
    throw new AppError('VALIDATION', 'Flow type must be auto, payments, auth, booking, order or generic.');
  }
  const flowType = flowTypeRaw as 'auto' | FlowType;

  const files = form.getAll('images');
  if (files.length > MAX_IMAGES) throw new AppError('VALIDATION', `Upload at most ${MAX_IMAGES} images.`);
  const images: NonNullable<GemmaCallOptions['images']> = [];
  let total = 0;
  for (const f of files) {
    if (typeof f === 'string') throw new AppError('VALIDATION', 'Images must be uploaded as files.');
    if (f.size > MAX_IMAGE_BYTES) throw new AppError('TOO_LARGE', 'Each image must be 3 MB or smaller.');
    total += f.size;
    if (total > MAX_TOTAL_BYTES) throw new AppError('TOO_LARGE', 'All images together must be 4 MB or smaller.');
    const bytes = new Uint8Array(await f.arrayBuffer());
    const mimeType = detectImageType(bytes);
    if (mimeType === null) throw new AppError('VALIDATION', 'Only JPEG, PNG or WEBP images are allowed.');
    images.push({ bytes, mimeType });
  }

  if (images.length === 0 && text.trim().length < 20) {
    throw new AppError('VALIDATION', 'Add at least one image or a description of 20 characters or more.');
  }

  const result = await runExtract({ flowName, flowType, text, images }, { client, model: env.models.extract });
  return Response.json(result);
});
