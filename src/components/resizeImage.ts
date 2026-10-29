// Client-side image preparation (SPEC §10.1 step 1): longest edge ≤ 1600 px, JPEG 0.8 on white,
// once more at 0.6 if still over 1.5 MB. Originals over 10 MB are rejected before decoding.

export const MAX_ORIGINAL_BYTES = 10 * 1024 * 1024;
const MAX_EDGE = 1600;
const SECOND_PASS_BYTES = 1.5 * 1024 * 1024;
export const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

export type PrepareResult = { ok: true; blob: Blob } | { ok: false; reason: 'type' | 'size' | 'decode' };

const toJpeg = (canvas: HTMLCanvasElement, quality: number) =>
  new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));

export async function prepareImage(file: File): Promise<PrepareResult> {
  if (!(ACCEPTED_TYPES as readonly string[]).includes(file.type)) return { ok: false, reason: 'type' };
  if (file.size > MAX_ORIGINAL_BYTES) return { ok: false, reason: 'size' };
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) return { ok: false, reason: 'decode' };
    ctx.fillStyle = '#FFFFFF'; // transparent areas become white
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    let blob = await toJpeg(canvas, 0.8);
    if (blob && blob.size > SECOND_PASS_BYTES) blob = await toJpeg(canvas, 0.6);
    return blob ? { ok: true, blob } : { ok: false, reason: 'decode' };
  } catch {
    return { ok: false, reason: 'decode' };
  }
}
