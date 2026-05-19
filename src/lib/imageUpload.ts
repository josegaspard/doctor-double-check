// Helpers for image uploads — prevent stuck/hung uploads when users pick
// huge phone-camera shots or HEIC files routed through the iOS HEIF→JPEG
// translation layer (Safari sometimes hands us multi-MB JPEGs that take
// 20+ seconds on slow networks).

const TARGET_MAX_DIM = 2048;
const TARGET_QUALITY = 0.85;
const COMPRESS_THRESHOLD_BYTES = 1.2 * 1024 * 1024; // 1.2MB

/**
 * Downscale an image File to <= TARGET_MAX_DIM longest edge and re-encode as
 * JPEG. Non-image files are returned as-is. PNGs with transparency keep PNG.
 * Falls back to the original file if anything goes wrong.
 */
export async function compressImageIfNeeded(file: File): Promise<File> {
  if (!file.type.startsWith('image/')) return file;
  if (file.size < COMPRESS_THRESHOLD_BYTES) return file;
  if (file.type === 'image/gif') return file; // keep animations

  try {
    const bitmap = await createImageBitmap(file).catch(async () => {
      // Fallback for browsers/files where createImageBitmap chokes (some HEIC paths).
      const img = new Image();
      const url = URL.createObjectURL(file);
      try {
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = () => reject(new Error('image decode failed'));
          img.src = url;
        });
        return img as unknown as ImageBitmap;
      } finally {
        URL.revokeObjectURL(url);
      }
    });

    const width = (bitmap as any).width as number;
    const height = (bitmap as any).height as number;
    const longest = Math.max(width, height);
    const scale = longest > TARGET_MAX_DIM ? TARGET_MAX_DIM / longest : 1;
    const w = Math.round(width * scale);
    const h = Math.round(height * scale);

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(bitmap as any, 0, 0, w, h);

    const mime = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
    const blob: Blob = await new Promise((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error('canvas.toBlob returned null'))),
        mime,
        TARGET_QUALITY,
      );
    });
    if (blob.size >= file.size) return file; // re-encode actually grew

    const ext = mime === 'image/png' ? 'png' : 'jpg';
    const safeName = file.name.replace(/\.[^.]+$/, '') + `.${ext}`;
    return new File([blob], safeName, { type: mime, lastModified: Date.now() });
  } catch {
    return file;
  }
}

/**
 * Race a promise against a timeout — prevents the UI from getting stuck on
 * a hung network request. Resolves with the inner promise or rejects with
 * a TimeoutError after `ms` milliseconds.
 */
export async function withTimeout<T>(p: Promise<T>, ms: number, label = 'upload'): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  try {
    return await Promise.race([
      p,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label}: tiempo agotado después de ${Math.round(ms / 1000)}s`)), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
